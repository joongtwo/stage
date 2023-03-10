// Copyright (c) 2022 Siemens

/**
 * @module js/senCompareService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import senCompareUtils from 'js/senCompareUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * performCompare
 * @param {Object} vmos selectd view model object
 * @param {String } contextKey  view key that represent the view
 * @return {Promise} promise of  soa response
 */
export let performCompare = function( vmos, contextKey ) {
    let element = appCtxService.getCtx( contextKey + '.modelObject' );
    let productContextInfo = appCtxService.getCtx( contextKey + '.productContextInfo' );

    let comapreContext = senCompareUtils.updateAndGetCompareContext( contextKey, vmos, element, productContextInfo );
    let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
    let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
    let sourceCompareInfo = comapreContext[ sourceContextKey ];
    let targetCompareInfo = comapreContext[ targetContextKey ];

    return _performCompare( sourceContextKey, targetContextKey, sourceCompareInfo, targetCompareInfo );
};

/**
 * performCompare
 * @param {Object} vmos selectd view model object
 * @param {String } contextKey  view key that represent the view
 * @param {Array}vmosToRemoved array of unassigned view model objects
 * @return {Object} return promise
 */
export let performCompareAfterUnAssigned = function( vmos, contextKey ) {
    senCompareUtils.updateUnAssignedState();
    return exports.performCompare( vmos, contextKey );
};

/**
 * _performCompare
 * @param {Object} sourceContextKey context view key of source
 * @param {Object} targetContextKey context view key of source
 * @param {Object} sourceCompareInfo compare information of source
 * @param {Object} targetCompareInfo compare information of target
 * @return {promise} promise
 */
let _performCompare = function( sourceContextKey, targetContextKey, sourceCompareInfo, targetCompareInfo ) {
    let deferred = AwPromiseService.instance.defer();
    let sourceElement = appCtxService.getCtx( sourceContextKey + '.topElement' );
    let targetElement = appCtxService.getCtx( targetContextKey + '.topElement' );

    let srcVmosToUpdate = senCompareUtils.getVmosToUpdate( sourceCompareInfo );
    let trgVmosToUpdate = senCompareUtils.getVmosToUpdate( targetCompareInfo );
    let compareMode = senCompareUtils.getCompareMode();

    if( _isValidCompare( sourceElement, srcVmosToUpdate, targetElement, trgVmosToUpdate, compareMode ) ) {
        let srcElement = senCompareUtils.getTopElement( sourceCompareInfo );
        let srcPciObject = senCompareUtils.getProductContext( sourceCompareInfo );
        let srcCursor = senCompareUtils.getCursor( sourceCompareInfo );
        let srcInput = _getInputFor( srcElement, srcPciObject, srcVmosToUpdate );

        let trgElement = senCompareUtils.getTopElement( targetCompareInfo );
        let trgPciObject = senCompareUtils.getProductContext( targetCompareInfo );
        let trgCursor = senCompareUtils.getCursor( targetCompareInfo );
        let trgInput = _getInputFor( trgElement, trgPciObject, trgVmosToUpdate );

        let compareInput = _getSoaInput( compareMode, srcInput, trgInput, srcCursor, trgCursor );
        _invokeCompareSoa( compareInput ).then( function( response ) {
            let sourceDifference = _processDifferences( response.sourceDifferences, response.pagedSourceDifferences );
            let targetDifference = _processDifferences( response.targetDifferences, response.pagedTargetDifferences );

            senCompareUtils.updateDifferencesInContext( sourceCompareInfo, sourceDifference );
            senCompareUtils.updateDifferencesInContext( targetCompareInfo, targetDifference );

            let updatedCompareObject = {
                sourceIdsToUpdate: _getVisibleUidsFor( srcVmosToUpdate ),
                targetIdsToUpdate: _getVisibleUidsFor( trgVmosToUpdate )
            };

            //set fresh compare mode to false load from cache in servr
            senCompareUtils.updateCompareMode( false );
            eventBus.publish( 'sen.compareComplete', updatedCompareObject );
        } );
    }

    deferred.resolve();
    return deferred.promise;
};

/**
 * Process the differences of given parameter
 * @param {Object} originalDifferences differences
 * @param {Object} pagedDifferences page differences
 *
 * @return {Object} differences
 */
let _processDifferences = function( originalDifferences, pagedDifferences ) {
    let diffs = {};
    if( originalDifferences ) {
        for( let key in originalDifferences ) {
            let value = originalDifferences[ key ];
            let uid = null;
            let diff = {};
            diff.status = value;
            if( value === 2 || value === 4 || value === 5 || value === 6 || value === 57 || value === 58 ) {
                let uids = key.split( senCompareUtils.getDelimiterKey() );
                uid = uids[ 0 ];
                if( uids.length > 1 ) {
                    let mappingUids = [];
                    for( let index = 1; index < uids.length; index++ ) {
                        mappingUids.push( uids[ index ] );
                    }
                    diff.mappingUids = mappingUids;
                }
            } else {
                uid = key;
            }
            diffs[ uid ] = diff;
        }
    }

    if( pagedDifferences ) {
        for( let object in pagedDifferences ) {
            let value = object.diff;
            let uid = null;
            let diff = {};
            diff.status = value;
            if( value === 2 || value === 4 || value === 5 || value === 6 || value === 57 || value === 58 ) {
                let uids = object.uids.split( senCompareUtils.getDelimiterKey() );
                uid = uids[ 0 ];
                if( uids.length > 1 ) {
                    let mappingUids = [];
                    for( let index = 1; index < uids.length; index++ ) {
                        mappingUids.push( uids[ index ] );
                    }
                    diff.mappingUids = mappingUids;
                }
            } else {
                uid = object.uids;
            }

            diffs[ uid ] = diff;
        }
    }
    return diffs;
};

/**
 * Get input of given object
 * @param {Object} element comparable object
 * @param {Object} pci product context information
 * @param {Array} visibleVmos array of view model objects
 * @return {Object}  object
 */
let _getInputFor = function( element, pci, visibleVmos ) {
    return {
        element: element,
        productContextInfo: pci,
        visibleUids: _getVisibleUidsFor( visibleVmos ),
        depth: -1
    };
};

/**
 * Get the  input for comparecontent2 soa
 * @param {boolean} compareMode compare mode
 * @param {Object} source source object
 * @param {Object} target target object
 * @param {Object} sourceCursor cursor of source object
 * @param {Object} targetCursor cursor of target object
 * @return {Object} input data
 */
let _getSoaInput = function( compareMode, source, target, sourceCursor, targetCursor ) {
    return {
        inputData: {
            source: source,
            target: target,
            startFreshCompare: compareMode,
            sourceCursor: sourceCursor,
            targetCursor: targetCursor,
            compareInBackground: false,
            compareOptions: {
                EBomSBomAlign: [ 'true' ]
            }
        }
    };
};
/**
 *Check the  validity of compare of given parameter
 * @param {Object} sourceElement top element of source view
 * @param {Array} sourceVmosToUpdate vmos to update of source view
 * @param {Object} targetElement top element of target view
 * @param {Array} targetVmosToUpdate vmos to update of target view
 * @param {boolean} compareMode true if freshCompare otherwise false
 * @return {boolean} true if valid otherwise false
 */
let _isValidCompare = function( sourceElement, sourceVmosToUpdate, targetElement, targetVmosToUpdate, compareMode ) {
    if( !sourceElement || !targetElement || sourceElement && targetElement && sourceElement.uid === targetElement.uid ) {
        return false;
    }

    if( sourceVmosToUpdate && targetVmosToUpdate ) {
        if( compareMode ) {
            return sourceVmosToUpdate.length > 0 && targetVmosToUpdate.length > 0;
        }

        return sourceVmosToUpdate.length > 0 || targetVmosToUpdate.length > 0;
    }

    return false;
};

let _invokeCompareSoa = function( soaInput ) {
    return soaSvc
        .postUnchecked( 'Internal-ActiveWorkspaceBom-2018-12-Compare', 'compareContent2', soaInput );
};

/**
 *
 * @param {Array} vmos  array of view model object
 * @return {Array} array of uids
 */
let _getVisibleUidsFor = function( vmos ) {
    let uids = [];
    _.forEach( vmos, function( vmo ) {
        uids.push( vmo.uid );
    } );

    return uids;
};

export default exports = {
    performCompare,
    performCompareAfterUnAssigned
};
