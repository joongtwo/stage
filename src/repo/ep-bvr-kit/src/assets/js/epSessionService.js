// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import epContextService from 'js/epContextService';
import appCtxSvc from 'js/appCtxService';
import awStateSvc from 'js/awStateService';
import { constants as epLoadConstants } from 'js/epLoadConstants';

/**
 * @module js/epSessionService
 */


const DEFAULT_PV_VAL = 'ALL';
const SESSION_TAG = 'session';

let mcn = null;
let balancingScope = null;
let tracking_cn = null;
let impacting_cn = null;

export const setMCN = ( mcnObj ) => { mcn = mcnObj; };

export const setImpactingCN = ( mcnObj ) => { impacting_cn = mcnObj; };

export const setTrackingCN = ( mcnObj ) => { tracking_cn = mcnObj; };

export const setBalancingScope = ( object ) => { balancingScope = object; };

export const getSessionSection = function( isPerformCheck ) {
    const dataEntries = [];
    dataEntries.push( createPVEntry() );
    const state = awStateSvc.instance;
    const epPageContext = epContextService.getPageContext();

    let closeOldWindows = appCtxSvc.getCtx( 'ep.closeOldWindows' );
    if( closeOldWindows && epPageContext ) {
        const unloadWindowsUid = epPageContext.collaborationContext ? epPageContext.collaborationContext.uid : state.params.uid;
        if( unloadWindowsUid ) {
            dataEntries.push( createUnloadSessionWindowsEntry( unloadWindowsUid ) );
        }
    }

    createPCISessionEntry( dataEntries, 'processPCI' );
    createPCISessionEntry( dataEntries, 'productPCI' );
    createPCISessionEntry( dataEntries, 'ebomPCI' );
    createPCISessionEntry( dataEntries, 'mbomPCI' );
    createPCISessionEntry( dataEntries, 'productionProgramPCI' );
    createPCISessionEntry( dataEntries, 'plantPCI' );
    createPCISessionEntry( dataEntries, 'functionalPlanPCI' );
    let rootLine = epContextService.getPageContext().loadedObject;
    let rootLineUid = rootLine ? rootLine.uid : '';

    if( mcn && rootLineUid !== '' ) {
        dataEntries.push( createMCNEntry() );
    }

    if( tracking_cn && rootLineUid !== '' ) {
        dataEntries.push( createTrackingCNEntry() );
    }

    if( impacting_cn && rootLineUid !== '' ) {
        dataEntries.push( createImpactingCNEntry() );
    }

    //for save we pass isPerformCheck to getSessionSection, for load - pass nothing
    if( typeof isPerformCheck !== 'undefined' && isPerformCheck !== null ) {
        dataEntries.push( createPerformCheckEntry( isPerformCheck ) );
    }

    if( rootLine ) {
        setBalancingScope( rootLine );
        dataEntries.push( createBalancingScopeEntry() );
    }

    return {
        sectionName: SESSION_TAG,
        dataEntries: dataEntries
    };
};

const createPVEntry = function() {
    let productVariantType = epContextService.getProductVariantType();
    const productVariantUid = epContextService.getProductVariantUid();

    if( productVariantType === null || _.isEmpty( productVariantType ) ) {
        productVariantType = DEFAULT_PV_VAL;
    }

    const entry = {
        entry: {
            productVariant: {
                nameToValuesMap: {
                    Type: [ String( productVariantType ).toUpperCase() ]
                }
            }
        }
    };

    if( productVariantUid && productVariantType === epLoadConstants.PV_UID ) {
        entry.entry.productVariant.nameToValuesMap.uid = [ productVariantUid ];
    }

    return entry;
};

/**
 * create PCI Session Entry
 *
 * @param {Object} dataEntries dataEntries list
 * @param {String} entryName entry name
 */
function createPCISessionEntry( dataEntries, entryName ) {
    let pciUid = awStateSvc.instance.params[ entryName ];
    if( !pciUid ) {
        const epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
        if( epTaskPageContext && epTaskPageContext[ entryName ] ) {
            pciUid = epTaskPageContext[ entryName ].uid;
        }
    }
    if( pciUid ) {
        let entry = { entry: {} };
        entry.entry[ entryName ] = {
            nameToValuesMap: {
                uid: [ pciUid ]
            }
        };
        dataEntries.push( entry );
    }
}

const createMCNEntry = function() {
    const rootL = epContextService.getPageContext().loadedObject ? epContextService.getPageContext().loadedObject.uid : '';
    if( rootL ) {
        return {
            entry: {
                appliedMCN: {
                    nameToValuesMap: {
                        value: [ mcn ],
                        rootLine: [ rootL ]
                    }
                }
            }
        };
    }
};

const createTrackingCNEntry = function() {
    const rootL = epContextService.getPageContext().loadedObject ? epContextService.getPageContext().loadedObject.uid : '';
    if( rootL ) {
        return {
            entry: {
                tracking_cn: {
                    nameToValuesMap: {
                        value: [ tracking_cn ],
                        rootLine: [ rootL ]
                    }
                }
            }
        };
    }
};

const createImpactingCNEntry = function() {
    const rootL = epContextService.getPageContext().loadedObject ? epContextService.getPageContext().loadedObject.uid : '';
    if( rootL ) {
        return {
            entry: {
                impacting_cn: {
                    nameToValuesMap: {
                        value: [ impacting_cn ],
                        rootLine: [ rootL ]
                    }
                }
            }
        };
    }
};

const createBalancingScopeEntry = () => ( {
    entry: {
        balancingScope: {
            nameToValuesMap: {
                uid: [ balancingScope.uid ]
            }
        }
    }
} );

const createPerformCheckEntry = ( isPerformCheck ) => ( {
    entry: {
        PerformCheck: {
            nameToValuesMap: {
                value: [ isPerformCheck.toString() ]
            }
        }
    }
} );

const createUnloadSessionWindowsEntry = ( unloadCCUID ) => ( {
    entry: {
        UnloadSessionWindows: {
            nameToValuesMap: {
                uid: [ unloadCCUID ]
            }
        }
    }
} );

export default {
    setMCN,
    setBalancingScope,
    getSessionSection,
    setTrackingCN,
    setImpactingCN
};
