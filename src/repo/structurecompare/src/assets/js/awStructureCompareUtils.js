// Copyright (c) 2022 Siemens

/**
 * @module js/awStructureCompareUtils
 */
import appCtxSvc from 'js/appCtxService';

var exports = {};

export let getChildCount = function( topElement ) {
    return parseInt( topElement.props.awb0NumberOfChildren.dbValues[ 0 ], 10 );
};

export let getDefaultCursor = function() {
    return {
        startReached: true,
        endReached: false,
        startIndex: 0,
        endIndex: 0,
        pageSize: 40,
        isForward: true
    };
};

export let processVMODifferences = function( compareContext, originalDifferences, pagedDifferences, gridLocation ) {
    let diffIds = {};
    let equivalenceIds = [];
    let mappingUids = {};
    let equivalentList = {};

    if( gridLocation === 1 ) {
        equivalentList = compareContext.srcEquivalentList;
    } else if( gridLocation === 2 ) {
        equivalentList = compareContext.trgEquivalentList;
    }
    if( !equivalentList ) {
        equivalentList = {};
    }

    if( originalDifferences ) {
        for( let key in originalDifferences ) {
            if( originalDifferences[ key ] === 2 || originalDifferences[ key ] === 4 ) {
                let ids = key.split( exports.getDelimiterKey() );
                diffIds[ ids[ 0 ] ] = originalDifferences[ key ];
                if( ids.length > 1 ) {
                    let tempEquivalenceIds = [];
                    for( let index2 = 1; index2 < ids.length; index2++ ) {
                        let vmo = {
                            uid: ids[ index2 ]
                        };
                        tempEquivalenceIds.push( ids[ index2 ] );
                        equivalenceIds.push( vmo );
                    }
                    mappingUids[ ids[ 0 ] ] = tempEquivalenceIds;
                    equivalentList[ ids[ 0 ] ] = tempEquivalenceIds;
                }
            } else {
                diffIds[ key ] = originalDifferences[ key ];
            }
        }
    }
    if( pagedDifferences ) {
        for( let index = 0; index < pagedDifferences.length; index++ ) {
            if( pagedDifferences[ index ].diff === 2 || pagedDifferences[ index ].diff === 4 ) {
                let uids = pagedDifferences[ index ].uids;
                if( uids ) {
                    let ids = uids.split( exports.getDelimiterKey() );
                    diffIds[ ids[ 0 ] ] = pagedDifferences[ index ].diff;
                    if( ids.length > 1 ) {
                        let tempEquivalenceIds = [];
                        for( let index2 = 1; index2 < ids.length; index2++ ) {
                            let vmo = {
                                uid: ids[ index2 ]
                            };
                            tempEquivalenceIds.push( ids[ index2 ] );
                            equivalenceIds.push( vmo );
                        }
                        mappingUids[ ids[ 0 ] ] = tempEquivalenceIds;
                        equivalentList[ ids[ 0 ] ] = tempEquivalenceIds;
                    }
                }
            } else {
                diffIds[ pagedDifferences[ index ].uids ] = pagedDifferences[ index ].diff;
            }
        }
    }
    if( gridLocation === 1 ) {
        compareContext.srcEquivalentList = equivalentList;
    } else if( gridLocation === 2 ) {
        compareContext.trgEquivalentList = equivalentList;
    }
    return {
        colorSwabIds: diffIds,
        equivalIds: equivalenceIds,
        mappingData: mappingUids
    };
};

export let getDelimiterKey = function() {
    return '##';
};

export let getContextKeys = function() {
    let _contextKeys = {
        leftCtxKey: null,
        rightCtxKey: null
    };
    let _multipleContext = appCtxSvc.getCtx( 'splitView' );
    if( _multipleContext ) {
        _contextKeys.leftCtxKey = _multipleContext.viewKeys[ 0 ];
        _contextKeys.rightCtxKey = _multipleContext.viewKeys[ 1 ];
    }
    return _contextKeys;
};

export default exports = {
    getChildCount,
    getDefaultCursor,
    processVMODifferences,
    getDelimiterKey,
    getContextKeys
};
