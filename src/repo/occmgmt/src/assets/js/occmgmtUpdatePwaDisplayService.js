// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtUpdatePwaDisplayService
 */
import appCtxSvc from 'js/appCtxService';
import editHandlerSvc from 'js/editHandlerService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import soa_kernel_soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awTableStateService from 'js/awTableStateService';
import expandRequests from 'js/invoker/expandRequests';

/**
 * {EventSubscriptionArray} Collection of eventBuss subscriptions to be removed when the controller is
 * destroyed.
 */
var _eventSubDefs = [];

var exports = {};

export let resetPwaContents = function( data, occContext ) {
    if( editHandlerSvc.editInProgress().editInProgress ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            refreshPWA( data, occContext );
        } );
    } else {
        refreshPWA( data, occContext );
    }
};

var refreshPWA = function( data, occContext ) {
    if ( expandRequests.reconfigureEnabled( occContext ) ) {
        let userGesture = 'unknown';
        let commandContext = {
            clientScopeURI: data.acePwaContext.clientScopeURI,
            occContext: occContext
        };
        expandRequests.reconfigureWindow( userGesture, commandContext );
    } else {
        if( occmgmtUtils.isTreeView() ) {
            var retainTreeExpansionStates = data ? data.retainTreeExpansionStates : null;
            if( appCtxSvc.ctx.aceActiveContext.context.requestPref ) {
                appCtxSvc.updatePartialCtx( 'aceActiveContext.context.retainTreeExpansionStates',  typeof retainTreeExpansionStates === 'boolean' ? retainTreeExpansionStates : true );
                appCtxSvc.updatePartialCtx( 'aceActiveContext.context.requestPref.resetTreeDisplay', true );
            }
        }
        eventBus.publish( 'awDataNavigator.reset', data );
    }
};

export let purgeExpandedNode = function( nodeToBePurged, loadedVMOs, purgeInputParams ) {
    //var nodesToBeSavedAsCollapsed = [];
    var setNodeStateToCollapsed = function( nodeToBeCollapsed, purgeInputParams ) {
        nodeToBeCollapsed.__expandState = {
            children: nodeToBeCollapsed.children,
            startChildNdx: nodeToBeCollapsed.startChildNdx,
            totalChildCount: nodeToBeCollapsed.totalChildCount,
            cursorObject: nodeToBeCollapsed.cursorObject,
            expandedNodes: nodeToBeCollapsed.children
        };

        nodeToBeCollapsed.children = null;
        nodeToBeCollapsed.startChildNdx = 0;
        nodeToBeCollapsed.totalChildCount = null;
        delete nodeToBeCollapsed.isExpanded;

        if( purgeInputParams ) {
            awTableStateService.saveRowCollapsed( purgeInputParams.data, purgeInputParams.gridId, nodeToBeCollapsed );
        }
    };

    if( loadedVMOs ) {
        //Collapse Expanded Object Logic.
        var begNdx = -1;
        var nDelete = 0;

        for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
            var currentVMO = loadedVMOs[ ndx ];
            if( currentVMO.id === nodeToBePurged.id ) {
                begNdx = ndx + 1;
                nDelete = 0;
            } else if( begNdx >= 0 ) {
                if( currentVMO.levelNdx > nodeToBePurged.levelNdx ) {
                    nDelete++;
                    if( purgeInputParams && purgeInputParams.markExpansionsInHierarchyCollapsed && currentVMO.isExpanded === true ) {
                        setNodeStateToCollapsed( currentVMO, purgeInputParams );
                    }
                } else {
                    break;
                }
            }
        }

        if( nDelete > 0 ) {
            setNodeStateToCollapsed( nodeToBePurged, purgeInputParams );
            loadedVMOs.splice( begNdx, nDelete );

            if( purgeInputParams && purgeInputParams.treeDataProvider ) {
                purgeInputParams.treeDataProvider.update( loadedVMOs );
            }
        }
    }
};

var refreshUpdatedElements = function( data ) {
    var elementsToRefresh = getAffectedElementsWhoseUnderlyingObjectIsModified( data );
    elementsToRefresh = elementsToRefresh.concat( getAffectedElementsWhosePropertiesAreModified( data ) );
    elementsToRefresh = _.uniq( elementsToRefresh );
    if( elementsToRefresh.length ) {
        soa_kernel_soaService.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: elementsToRefresh
        } );
    }
};

var getAffectedElementsWhosePropertiesAreModified = function( data ) {
    var objectsInInactiveViewWithModifiedProps = [];
    if( occmgmtUtils.isTreeView() && appCtxSvc.ctx.aceActiveContext.context.vmc && occmgmtSplitViewUpdateService.getInactiveViewKey() && !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
        var activeViewEditHandler = editHandlerSvc.getActiveEditHandler();
        var dataSource = activeViewEditHandler ? activeViewEditHandler.getDataSource() : null;
        var _modProps = dataSource ? dataSource.getAllModifiedProperties() : null;
        if( _modProps && _modProps.length > 0 ) {
            var inactiveViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
            _.forEach( data.updatedObjects, function _iterateUpdatedObjects( updatedObj ) {
                if( updatedObj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                    var affectedElementsInView = occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveViewKey, updatedObj );
                    _.forEach( affectedElementsInView, function( affectedElement ) {
                        var isAffectedElementAlreadyRefreshed = data.updatedObjects.filter( function( mo ) {
                            return mo.uid === affectedElement.id;
                        } ).length > 0;
                        if( !isAffectedElementAlreadyRefreshed ) {
                            objectsInInactiveViewWithModifiedProps.push( affectedElement );
                            // Force refresh of updated object to avoid continuous refreshObject SOA call.(LCS-304255)
                            objectsInInactiveViewWithModifiedProps.push( updatedObj );
                        }
                    } );
                }
            } );
        }
    }
    return objectsInInactiveViewWithModifiedProps;
};

var getAffectedElementsWhoseUnderlyingObjectIsModified = function( data ) {
    var affectedElementsToRefresh = [];

    // Get Selected Elements in Active View
    var affectedElementsInView = appCtxSvc.ctx.mselected ? appCtxSvc.ctx.mselected.slice() : {};

    //Get Affected Elements in inactive View
    var inactiveViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
    if( inactiveViewKey && appCtxSvc.ctx[ inactiveViewKey ] && appCtxSvc.ctx[ inactiveViewKey ].vmc && !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
        _.forEach( appCtxSvc.ctx.mselected, function( modelObject ) {
            var affectedElementsInInactiveView = occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveViewKey, modelObject );
            affectedElementsInView = affectedElementsInView.concat( affectedElementsInInactiveView );
        } );
    }

    _.forEach( affectedElementsInView, function( affectedElement ) {
        var underlyingObjectUid = !_.isUndefined( affectedElement.props ) && !_.isUndefined( affectedElement.props.awb0UnderlyingObject ) ?
            affectedElement.props.awb0UnderlyingObject.dbValues[ 0 ] : null;
        var isUnderlyingObjectModified = data.updatedObjects.filter( function( mo ) {
            return mo.uid === underlyingObjectUid;
        } ).length > 0;
        if( isUnderlyingObjectModified ) {
            var isAffectedElementAlreadyRefreshed = data.updatedObjects.filter( function( mo ) {
                return mo.uid === affectedElement.uid;
            } ).length > 0;
            if( !isAffectedElementAlreadyRefreshed ) {
                affectedElementsToRefresh.push( affectedElement );
            }
        }
    } );

    return affectedElementsToRefresh;
};

export let initialize = function( contextKey ) {
    _eventSubDefs.push( eventBus.subscribe( 'acePwa.reset', function( data ) {
        exports.resetPwaContents( data );
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'cdm.updated', function( data ) {
        refreshUpdatedElements( data );
    } ) );
};

export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
};

export default exports = {
    resetPwaContents,
    initialize,
    destroy,
    purgeExpandedNode
};
