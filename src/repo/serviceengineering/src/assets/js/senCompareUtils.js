// Copyright (c) 2022 Siemens

/**
 * @module js/senCompareUtils
 */
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};
const _compareContextKey = 'senCompareContext';

/**
 * Update and get compare information of given context
 * @param {String} contextKey name of the context e.g ebomContext, sbomContext etc.
 * @param {Array} visibleVmos array of visible view model object
 * @param {Object} topElement top element
 * @param {Object} productContextInfo product context information
 * @return {Object} an object for given context
 */
export let updateAndGetCompareContext = function( contextKey, visibleVmos, topElement, productContextInfo ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );

    if( !comapreContext ) {
        comapreContext = {};
        appCtxService.updateCtx( _compareContextKey, comapreContext );
    }

    let compareInfo = comapreContext[ contextKey ];
    if( !compareInfo ) {
        compareInfo = {};
        comapreContext[ contextKey ] = compareInfo;
    }

    compareInfo.visibleVmos = visibleVmos;
    compareInfo.topElement = topElement;
    compareInfo.productContextInfo = productContextInfo;

    return comapreContext;
};

/**
 * Get compare mode
 * @return {boolean}  boolean default true
 */
export let getCompareMode = function() {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    if( comapreContext && comapreContext.hasOwnProperty( 'compareMode' ) ) {
        return comapreContext.compareMode;
    }
    return true;
};

/**
 * Update compare mode
 * @param {boolean} freshCompare true if fresh compare otherwise false
 */
export let updateCompareMode = function( freshCompare ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    if( comapreContext ) {
        comapreContext.compareMode = freshCompare;
    }
};
/**
 * Get top element of given of object
 * @param  {Object}compareInfo compareInfo
 * @return {Object} top element
 */
export let getTopElement = function( compareInfo ) {
    return compareInfo ? compareInfo.topElement : null;
};

/**
 * Get view model objects of given object
 * @param  {Object}compareInfo compareInfo
 * @return {Array} view model objects
 */
export let getVmosToUpdate = function( compareInfo ) {
    let compareMode = exports.getCompareMode();
    if( compareInfo && compareInfo.differences && !compareMode ) {
        let vmosToUpdate = [];
        _.forEach( compareInfo.visibleVmos, function( vmo ) {
            if( !compareInfo.differences[ vmo.uid ] ) {
                vmosToUpdate.push( vmo );
            }
        } );

        if( vmosToUpdate.length <= 0 ) {
            _.forEach( compareInfo.visibleVmos, function( vmo ) {
                vmosToUpdate.push( vmo );
            } );
            return vmosToUpdate;
        }
        return vmosToUpdate;
    }
    return compareInfo ? compareInfo.visibleVmos : null;
};

/**
 * Get product context objects of given object
 * @param  {Object}compareInfo compareInfo
 * @return {Object} product context objects
 */
export let getProductContext = function( compareInfo ) {
    return compareInfo ? compareInfo.productContextInfo : null;
};

/**
 * Get cursor object of given object
 * @param  {Object}compareInfo compareInfo
 * @return {Object} cursor object
 */
export let getCursor = function( compareInfo ) {
    if( compareInfo && compareInfo.cursor ) {
        return compareInfo.cursor;
    }
    return {
        startReached: false,
        endReached: false,
        startIndex: -1,
        endIndex: 0,
        pageSize: 40,
        isForward: true
    };
};

/**
 * Update the difference in cache of given compare information
 * @param {Object} compareInfo comapare information
 * @param {Object} differences differences
 */
export let updateDifferencesInContext = function( compareInfo, differences ) {
    if( compareInfo ) {
        if( exports.getCompareMode() ) {
            delete compareInfo.differences;
        }

        if( compareInfo.differences ) {
            _.forEach( differences, function( diff, paramName ) {
                compareInfo.differences[ paramName ] = diff;
            } );
        } else {
            compareInfo.differences = differences;
        }
    }
};


/**
 *Get delimiter key
 @return {String} delimeter key
 */
export let getDelimiterKey = function() {
    return '##';
};


/**
 * Get status of given uid
 * @param {String} contextKey view key tat represent the view
 * @param {String} uid uid of the object
 * @return {number} status
 */
export let getStatus = function( contextKey, uid ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    if( comapreContext ) {
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo && compareInfo.differences ) {
            let diff = compareInfo.differences[ uid ];
            return diff ? diff.status : null;
        }
    }
};

/**
 * find target uids for a given uid from the given context
 * @param {String} contextKey name of the context e.g ebomContext, sbomContext etc.
 * @param {String} uid of source object.
 * @return {Array}  uids of target objects
 */
export let findDifferencesFor = function( contextKey, uid ) {
    let comapreContext = appCtxService.getCtx( _compareContextKey );

    if( comapreContext ) {
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo && compareInfo.differences ) {
            let difference = compareInfo.differences[uid];
            if( difference && difference.mappingUids ) {
                return difference.mappingUids || [];
            }
        }
    }
    return [];
};

/**
 *Update compare status
 @param {String} contextKey view key that represent view
 @param {Array} uids array of uids
 @param {Object} supportedStatuses supportedStatuses
 */
export let updateCompareStatus = function( contextKey, uids, supportedStatuses ) {
    let updatedCompareStatus = {};
    if( uids ) {
        let comapreContext = appCtxService.getCtx( _compareContextKey );
        let compareInfo = comapreContext[ contextKey ];
        if( compareInfo ) {
            _.forEach( uids, function( uid ) {
                let diff = compareInfo.differences ? compareInfo.differences[ uid ] : null;
                _.forEach( supportedStatuses, function( supportedStatus ) {
                    if( diff ) {
                        if( _.indexOf( supportedStatus.statuses, diff.status ) > -1 ) {
                            if( !updatedCompareStatus[ uid ] ) {
                                updatedCompareStatus[ uid ] = [ supportedStatus.columnName ];
                            } else if( !updatedCompareStatus[ uid ][ supportedStatus.columnName ] ) {
                                updatedCompareStatus[ uid ].push( supportedStatus.columnName );
                            }
                        }
                    } else {
                        // this required to remove status from column during unassigned
                        if( !updatedCompareStatus[ uid ] ) {
                            updatedCompareStatus[ uid ] = [ supportedStatus.columnName ];
                        } else if( !updatedCompareStatus[ uid ][ supportedStatus.columnName ] ) {
                            updatedCompareStatus[ uid ].push( supportedStatus.columnName );
                        }
                    }
                } );
            } );
        }
    }
    eventBus.publish( 'viewModelObject.propsUpdated', updatedCompareStatus );
};

/**
 * updates compareInfo after removing objects from Sbom
 */
export let updateCompareInfo = function() {
    updateCompareMode( true );
    eventBus.publish( 'senEbomTreeTable.plTable.loadProps' );
};


/*
 * Reset compare context cache for unassigned
 */
export let updateUnAssignedState = function() {
    let comapreContext = appCtxService.getCtx( _compareContextKey );
    if( comapreContext.isUnAssignedState ) {
        delete comapreContext.isUnAssignedState;
        return;
    }
    comapreContext.isUnAssignedState = true;
    let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
    let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
    if( comapreContext.hasOwnProperty( sourceContextKey ) ) {
        delete comapreContext[ sourceContextKey ].visibleVmos;
        delete comapreContext[ sourceContextKey ].topElement;
        delete comapreContext[ sourceContextKey ].productContextInfo;
    }
    if( comapreContext.hasOwnProperty( targetContextKey ) ) {
        delete comapreContext[ targetContextKey ].visibleVmos;
        delete comapreContext[ targetContextKey ].topElement;
        delete comapreContext[ targetContextKey ].productContextInfo;
    }

    updateCompareMode( true );
};


/**
 * Clear compare context
 */
export let resetCompareContext = function() {
    appCtxService.unRegisterCtx( _compareContextKey );
};

export default exports = {
    updateAndGetCompareContext,
    getCompareMode,
    updateCompareMode,
    getTopElement,
    getVmosToUpdate,
    getProductContext,
    getCursor,
    updateDifferencesInContext,
    getDelimiterKey,
    getStatus,
    findDifferencesFor,
    updateCompareStatus,
    updateCompareInfo,
    updateUnAssignedState,
    resetCompareContext
};
