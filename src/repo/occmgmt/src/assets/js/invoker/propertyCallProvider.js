/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * propertyCallProvider
 *
 * Responsible for providing a sequence of getTableViewModelProperty calls
 * to be invoked during a tree load user action. Interacts with tree context
 * to choose best ordering/parameterisation of the calls.
 *
 * Called only by invoker.
 *
 * @module js/invoker/propertyCallProvider
 */

import backgroundSoaSvc from 'js/invoker/backgroundSoaService';
import soaSvc from 'soa/kernel/soaService';
import propertyLoader from 'js/invoker/propertyLoader';
import propertyCallTimer from 'js/invoker/propertyCallTimer';
import eventBus from 'js/eventBus';
import invoker from 'js/invoker/invoker';
import occmgmtIconSvc from 'js/occmgmtIconService';
import parsingUtils from 'js/parsingUtils';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import _ from 'lodash';

let _getInitialPropSearchRange = function( vmc, uwDataProvider, num ) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    let startIndex = 0;
    let endIndex = loadedVMObjects.length - 1;

    // Find an optimal window of 2x page size around current window position
    var _firstIndex = uwDataProvider.scrollPosition.firstIndex;
    var _lastIndex = uwDataProvider.scrollPosition.lastIndex;
    var pageSize = _lastIndex - _firstIndex;
    startIndex = _firstIndex;
    endIndex = Math.max( _firstIndex + pageSize, num );
    let startTrim = 0;
    let endTrim = 0;
    let maxIndex = loadedVMObjects.length - 1;
    if ( startIndex < 0 ) {
        startTrim = -startIndex;
        startIndex = 0;
    }
    if ( endIndex > maxIndex ) {
        endTrim = maxIndex - endIndex;
        endIndex = maxIndex;
    }
    startIndex = Math.max( startIndex - endTrim, 0 );
    endIndex = Math.min( endIndex + startTrim, maxIndex );
    return [ startIndex, endIndex ];
};

let getMissingVMTN = function( loadedVMObjects, startIndex, endIndex, increment, num, excludedNodes ) {
    let missingVMTN = [];
    for( let i = startIndex; i <= endIndex; i += increment ) {
        let vmtn = loadedVMObjects[ i ];
        if( vmtn && !vmtn.props && !excludedNodes.has( vmtn ) ) {
            missingVMTN.push( vmtn );
            if( missingVMTN.length >= num ) {
                break;
            }
        }
    }
    return missingVMTN;
};

let _getObjsWithMissingProps = function( vmc, uwDataProvider, num, excludedNodes ) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    let startIndex = 0;
    let maxIndex = loadedVMObjects.length - 1;
    let endIndex = maxIndex;
    if ( uwDataProvider && uwDataProvider.scrollPosition ) {
        [ startIndex, endIndex ] = _getInitialPropSearchRange( vmc, uwDataProvider, num );
    }
    let missingVMTN = getMissingVMTN( loadedVMObjects, startIndex, endIndex, +1, num, excludedNodes );
    let extra = num - missingVMTN.length;
    if( extra > 0 ) {
        while( (  endIndex < maxIndex + num  ||  startIndex >= 0  ) && missingVMTN.length < num  ) {
            startIndex = Math.max( 0, startIndex );
            endIndex = Math.min( maxIndex + num, endIndex );
            let extraVMTN = getMissingVMTN( loadedVMObjects, startIndex, endIndex, +1, extra, excludedNodes );
            missingVMTN.push( ...extraVMTN );
            startIndex -= num;
            endIndex += num;
            extra -= missingVMTN.length;
        }
    }

    return missingVMTN;
};

let _getTVMPSoaInput = function( missingVMTN, clientScopeURI, columnsToExclude ) {
    let uids = [];
    for ( let vmtn of missingVMTN ) {
        uids.push( vmtn.uid );
    }
    return {
        input: {
            objectUids: uids,
            columnConfigInput: {
                clientName: 'AWClient',
                hostingClientName: '',
                clientScopeURI: clientScopeURI,
                operationType: 'Union',
                columnsToExclude: columnsToExclude
            },
            requestPreference: {
                typesToInclude: []
            }
        }
    };
};

let _addToPending = function( requestedVMTNs, pendingSet ) {
    for( let vmtn of requestedVMTNs ) {
        pendingSet.add( vmtn );
    }
};

let _removeFromPending = function( requestedVMTNs, pendingSet ) {
    for( let vmtn of requestedVMTNs ) {
        pendingSet.delete( vmtn );
    }
};

let _updateIconURL = function( requestedVMTNs ) {
    for( let vmtn of requestedVMTNs ) {
        let iconURL = occmgmtIconSvc.getIconURL( vmtn );
        if( iconURL !== undefined && iconURL !== '' ) {
            vmtn.iconURL = iconURL;
        }
    }
};

/**
 * Extracts the view model properties from response and updates the corresponding viewmodelObject
 *
 * @param {ViewModelObject[]} viewModelObjects - view model object to update.
 * @param {Object} response - response
 */
function _processViewModelObjectsFromJsonResponse( viewModelObjects, response ) {
    // update the view model object with the view model properties.
    if( response.viewModelJSON && !response.viewModelPropertiesJsonString ) {
        // remove after SOA is updated
        response.viewModelPropertiesJsonString = response.viewModelJSON;
    }

    if( response && response.viewModelPropertiesJsonString ) {
        var responseObject = parsingUtils.parseJsonString( response.viewModelPropertiesJsonString );
        var objectsInResponse = responseObject.objects;

        _.forEach( viewModelObjects, function( viewModelObject ) {
            var objectUpdated = false;
            if( viewModelObject ) {
                _.forEach( objectsInResponse, function( currentObject ) {
                    if( !objectUpdated && currentObject && currentObject.uid === viewModelObject.uid ) {
                        tcViewModelObjectService.mergeObjects( viewModelObject, currentObject );
                        objectUpdated = true;
                    }
                } );
            }
        } );
    }
}

// eslint-disable-next-line sonarjs/no-unused-collection
var callStats = [];

export default class TreePropertyCallProvider {
    // Construct an TreePropertyCallProvider
    constructor( commandContext, nextInChain ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.clientScopeURI = commandContext.clientScopeURI;
        this.columnsToExclude = commandContext.occContext.columnsToExclude;
        this.gridId = 'occTreeTable';
        this.vmc = commandContext.occContext.vmc;
        this.uwDataProvider = commandContext.uwDataProvider;
        this.pending = new Set();
        this.occContext = commandContext.occContext;
    }

    getObjectsWithoutProps() {
        let numProps =  this.count === 0 ? 100 : propertyCallTimer.getNumberOfLinesToProcess( this.occContext );
        return _getObjsWithMissingProps( this.vmc, this.uwDataProvider, numProps, this.pending );
    }

    invokeNext() {
        // TODO: Chain of responsibility

        let requestVMTNs = this.getObjectsWithoutProps();
        if ( requestVMTNs.length === 0 ) {
            return { calls: 0, finished: true };
        }

        this.count++;
        let callId = 'props_' + this.count;
        console.log( callId + ': TreePropertyCallProvider_invokeNext' );
        let count = this.count;

        let soaService = soaSvc;
        let callType = 'foreground';
        if ( this.occContext.BackGroundSoaDebug === 'true' ) {
            soaService = backgroundSoaSvc;
            callType = 'background';
        }

        var input = _getTVMPSoaInput( requestVMTNs, this.clientScopeURI, this.columnsToExclude );
        soaService.post( 'Internal-AWS2-2017-12-DataManagement', 'getTableViewModelProperties', input )
            // eslint-disable-next-line no-unused-vars
            .then( function( _response ) {
                // TODO: Can we also get a server-side duration? That would let us
                // calcuate latency
                let duration = invoker.callFinished( callId );
                callStats.push( { count, duration } );
                if( this.occContext && this.occContext.LoadTreePropsTimerDebug && this.occContext.LoadTreePropsTimerDebug === 'true' ) {
                    propertyCallTimer.setPropertyCallTimer( duration, requestVMTNs.length );
                }
                propertyLoader.updateTreeNodePropertiesFromCDM( requestVMTNs );
                // Call to process DCP from response Json
                _processViewModelObjectsFromJsonResponse( requestVMTNs, _response.output );
                _updateIconURL( requestVMTNs );
                _removeFromPending( requestVMTNs, this.pending );
                // Notify table to refresh to reflect new prop values in vmos
                // TODO: Do this all the time? Or only when the new props are visible?
                eventBus.publish( this.gridId + '.plTable.clientRefresh' );
            }.bind( this ) );

        // Add set of VMTNs that we've just requested to the pending set to avoid requesting them
        // again if we get another invokation of property fetching before this current one is finished
        _addToPending( requestVMTNs, this.pending );

        // After invoking a call, always return not finished; more objects may
        // later appear to fetch properties for and this will gives us another chance
        var timeEstimate = requestVMTNs.length * 4 + 100; // getTVMP with a few props typically takes 15ms per object + 500ms constant
        return { calls: 1, type: callType, nextAction: 'async', time: timeEstimate, finished: false };
    }
}
