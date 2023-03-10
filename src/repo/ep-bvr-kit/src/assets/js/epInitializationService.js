// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Initialization service for EasyPlan.
 *
 * @module js/epInitializationService
 */

import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import appCtxService from 'js/appCtxService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import epSessionService from 'js/epSessionService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import epBackToBalancingService from 'js/epBackToBalancingService';
import tcSvrVer from 'js/TcServerVersion';
import { initializePage } from 'js/AwBaseSublocationService';
import AwPromiseService from 'js/awPromiseService';
import epStructureConfigurationService from 'js/epStructureConfigurationService';
import localeService from 'js/localeService';
import app from 'app';


let unSubscribeEvents = [];
let originalUseObjectQuotaValue;
let imanObjectTypePolicyId;
let isTCPlatformVersionUpdated = false;
let isInitialized = false;

const EP_SCOPE_OBJECT_KEY = 'ep.scopeObject';
const EP_LOADED_PRODUCT_OBJECT_KEY = 'ep.loadedProductObject';
const EP_LOADED_CC_OBJECT_KEY = 'ep.loadedCCObject';
const M_SELECTED_KEY = 'mselected';
const SELECTED_KEY = 'selected';
const EP_TASK_PAGE_CONTEXT = 'epTaskPageContext';
const EASYPLAN_ADMIN = 'easyplan.admin';
const MANAGE_PAGE_NEW = 'manageWorkPackageNew';
const EP_LOADED_RESOURCE_OBJECT_KEY = 'ep.loadedResourceObject';
const EP_PLANT_STRUCTURE_INFO = 'ep.plantStructureInfo';
const EP_STATES = [
    'easyplan',
    'ticonRoot'
];

/**
 * Reset EP context
 */
export function resetEpContext() {
    appCtxService.updatePartialCtx( EP_SCOPE_OBJECT_KEY, null );
    appCtxService.updatePartialCtx( EP_LOADED_PRODUCT_OBJECT_KEY, null );
    appCtxService.updatePartialCtx( EP_LOADED_CC_OBJECT_KEY, null );
    appCtxService.updatePartialCtx( M_SELECTED_KEY, [] );
    appCtxService.updatePartialCtx( SELECTED_KEY, {} );
    appCtxService.unRegisterCtx( EP_TASK_PAGE_CONTEXT );
    appCtxService.updatePartialCtx( EP_LOADED_RESOURCE_OBJECT_KEY, null );
}

/**
 * This method is used to initializa location/sublocation ctx for EP Task pages
 */
export function initializeEPPage( provider ) {
    // Skip in case of MBM since it has two different sublocations on same page.
    return AwStateService.instance.current.name !== 'multiBOMManager' ? initializePage( provider ) : AwPromiseService.instance.resolve();
}

/**
 * This method is used to navigate to EasyPlan object
 */
export function init() {
    if( !isTCPlatformVersionUpdated ) {
        updatePlatformVersion();
        isTCPlatformVersionUpdated = true;
    }

    // Don't init if already done
    if( isInitialized ) {
        // Make sure ctx objectQuotaContext.useObjectQuota is set to true so,
        // windows in server won't be unloaded in the soa calls
        appCtxService.registerCtx( 'objectQuotaContext', {
            useObjectQuota: true
        } );
        return;
    }

    let currentStateName = AwStateService.instance.current.name;
    let currentStateParent = AwStateService.instance.current.parent;
    // Don't init if NOT EP state
    if( !( EP_STATES.includes( currentStateName ) || EP_STATES.includes( currentStateParent ) ) ) {
        return;
    }
    isInitialized = true;
    //======End Validation======

    epBackToBalancingService.init();
    mfeVMOLifeCycleSvc.init();
    originalUseObjectQuotaValue = appCtxService.getCtx( 'objectQuotaContext.useObjectQuota' );
    if( !originalUseObjectQuotaValue ) {
        appCtxService.registerCtx( 'objectQuotaContext', {
            useObjectQuota: true
        } );
        appCtxService.registerPartialCtx( 'ep.closeOldWindows', true );
    }
    imanObjectTypePolicyId = propertyPolicySvc.register( {
        types: [ {
            name: 'ImanType',
            properties: [ {
                name: 'parent_types'
            }, {
                name: 'type_name'
            } ]
        },
        {
            name: 'Awb0Element',
            properties: [ {
                name: 'mbm0ManufacturingRepresentations'
            },
            {
                name: 'mbm0AssignmentDomain'
            },
            {
                name: 'awb0NumberOfChildren'
            },
            {
                name: 'awb0CopyStableId'
            },
            {
                name: 'awb0UnderlyingObject'
            },
            {
                name: 'awb0UnderlyingObjectType'
            },
            {
                name: 'awb0Parent',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        },
        {
            name: 'Awb0ProductContextInfo',
            properties: [ {
                name: 'awb0Product',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: 'Awb0ProductContextInfo',
            properties: [ {
                name: 'awb0Product',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0CurrentRevRule',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0SupportedFeatures',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0EffDate'
            },
            {
                name: 'awb0EffEndItem',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0EffUnitNo'
            },
            {
                name: 'awb0EffectivityGroups',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0StartEffDates'
            },
            {
                name: 'awb0EndEffDates'
            },
            {
                name: 'awb0StartEffUnits'
            },
            {
                name: 'awb0EndEffUnits'
            },
            {
                name: 'awb0VariantRules',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0VariantRuleOwningRev',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0ClosureRule',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        },
        {
            name: 'Awb0FeatureList',
            properties: [ {
                name: 'awb0AvailableFeatures'
            },
            {
                name: 'awb0NonModifiableFeatures'
            }
            ]
        },
        {
            name: 'RevisionRule',
            properties: [ {
                name: 'object_desc'
            },
            {
                name: 'suppressed'
            }
            ]
        }
        ]

    } );
    epStructureConfigurationService.initialize();
}

/**
 * Load model
 *
 * @return {Object} readOnlyEffectivityModeData - the effectivity data for the read only message
 */
export function loadModel() {
    let currentStateName = AwStateService.instance.current.name;
    let currentStateParent = AwStateService.instance.current.parent;

    /*
       TODO :For time being making this comment out once local CN from server is complete
       will remove the comment

    */

    if( AwStateService.instance.params.mcn ) {
        epSessionService.setMCN( AwStateService.instance.params.mcn );
    }

    if( AwStateService.instance.params.tracking_cn ) {
        epSessionService.setTrackingCN( AwStateService.instance.params.tracking_cn );
    }

    if( AwStateService.instance.params.impacting_cn ) {
        epSessionService.setImpactingCN( AwStateService.instance.params.impacting_cn );
    }

    let loadTypeInputs;
    let loadedObjectUid = AwStateService.instance.params.uid;
    if( !loadedObjectUid ) {
        loadedObjectUid = AwStateService.instance.params.cc_uid;
    }

    const loadType = [];
    const additionalLoadParams = [];
    if( currentStateName.includes( EASYPLAN_ADMIN ) || currentStateParent.includes( EASYPLAN_ADMIN ) || currentStateName.includes( MANAGE_PAGE_NEW ) ) {
        loadType.push( epLoadConstants.CC );
    }
    loadType.push( epLoadConstants.HEADER );

    loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( loadType, loadedObjectUid, null, null, additionalLoadParams );
    return epLoadService.loadObject( loadTypeInputs, true ).then(
        function( response ) {
            const loadedVMO = mfeVMOLifeCycleSvc.createViewModelObjectFromUid( loadedObjectUid );
            appCtxService.updatePartialCtx( EP_SCOPE_OBJECT_KEY, loadedVMO );
            appCtxService.updatePartialCtx( M_SELECTED_KEY, [ loadedVMO ] );
            appCtxService.updatePartialCtx( SELECTED_KEY, loadedVMO );

            if( response.loadedObjectsMap.ChangeNoticeRevision ) {
                const mcnObject = response.loadedObjectsMap.ChangeNoticeRevision[ 0 ];
                appCtxService.updatePartialCtx( 'ep.mcnObject', mcnObject );
            }

            if( response.loadedObjectsMap.collaborationContext ) {
                const loadedCCObjectVMO = mfeVMOLifeCycleSvc.createViewModelObjectFromModelObject( response.loadedObjectsMap.collaborationContext[ 0 ] );
                appCtxService.updatePartialCtx( EP_LOADED_CC_OBJECT_KEY, loadedCCObjectVMO );
            }

            updatePlantStructureInfo( response );

            /* Let us maintain epTaskPageContext parallel to epPageContext for now so that we
            don't break existing functionality. We will take care of this once we decide what to use
            for maintaining task page context to be able to navigate through different tasks */
            updateTaskPageContext( response );
            appCtxService.updatePartialCtx( 'epTaskPageContext.pageName', currentStateName );
            updateConfigurationFlagInfo( response );
            const readOnlyModeCaptionData = getReadOnlyByEffectivityCaptionData( response );
            eventBus.publish( 'mfe.scopeObjectChanged' );
            return readOnlyModeCaptionData;
        } );
}

/**
 * This method loads CC structure context which will be used while navigating to Author BOE task page.
 * @returns
 */
export function loadCCStructures( ccObject ) {
    if( ccObject ) {
        const loadType = [ epLoadConstants.CC, epLoadConstants.HEADER ];
        const additionalLoadParams = [];

        const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( loadType, ccObject.uid, null, null, additionalLoadParams );
        return epLoadService.loadObject( loadTypeInputs, true ).then( ( response ) => {
            updatePlantStructureInfo( response );
            updateTaskPageContext( response );
            return;
        } );
    }
}

/**
 * update the task page context and store Configuration flag information
 * @param {Object} response Response
 */
export function updateConfigurationFlagInfo( response ) {
    Object.keys( response.loadedObjectsMap ).forEach( ( structureKey ) => {
        const loadedObject = response.loadedObjectsMap[ structureKey ][ 0 ];
        if( loadedObject.modelType.typeHierarchyArray.includes( 'BOMLine' ) && Object.keys( response.relatedObjectsMap ).includes( loadedObject.uid ) ) {
            appCtxService.updatePartialCtx( EP_TASK_PAGE_CONTEXT + '.' + structureKey + 'ConfigFlags', response.relatedObjectsMap[ loadedObject.uid ].additionalPropertiesMap2 );
        }
    } );
}

/**
 * update the task page context
 * @param {Object} response with loadedObjectsMap map of loaded objects
 */
export function updateTaskPageContext( response ) {
    const taskPageContext = {};
    const loadedObjectsMap = response.loadedObjectsMap;
    for( let object in loadedObjectsMap ) {
        taskPageContext[ object ] = loadedObjectsMap[ object ][ 0 ];
        let targetObject = taskPageContext[ object ];
        let sourceObject = loadedObjectsMap[ object ][ 0 ];
        Object.assign( targetObject, sourceObject );
    }
    appCtxService.updateCtx( EP_TASK_PAGE_CONTEXT, taskPageContext );
    updatePlantStructureInfo( response );
}

/**
 * update the task page context
 *
 * @param {String} name the page name
 * @param {Object} value the task page context
 */
export function updateTaskPageName( name, value ) {
    appCtxService.updatePartialCtx( 'epTaskPageContext.' + name, value );
}

/**
 * Update plantStructureInfo (e.g revision rule for plant object)
 * @param {Object} response response of load SOA for CC
 */
export function updatePlantStructureInfo( response ) {
    if( response.loadedObjectsMap.plantStructureContext ) {
        const plantStructureContextRelatedObjects = response.relatedObjectsMap[ response.loadedObjectsMap.plantStructureContext[ 0 ].uid ];
        const revisionRule = {
            uid: plantStructureContextRelatedObjects.additionalPropertiesMap2.revisionRule[ 0 ],
            type: 'revisionRule'
        };
        appCtxService.updatePartialCtx( EP_PLANT_STRUCTURE_INFO, revisionRule );
    }
}

/**
 * Check for read only mode according to effectivity and get the date for the read only message
 * @param {ObjectArray} loadResponse - the load soa response
 *
 * @return {Object} readOnlyModeCaptionData - the data for the read only message
 */
export function getReadOnlyByEffectivityCaptionData( loadResponse ) {
    const MBC_IS_READ_ONLY = epBvrConstants.MBC_IS_READ_ONLY;
    let isReadOnlyMode = false;
    const resource = localeService.getLoadedText( '/i18n/structureConfigurationMessages' );

    const workPackage = loadResponse.loadedObjectsMap.collaborationContext[ 0 ];
    if( workPackage ) {
        const collaborationContextUid = workPackage.uid;
        if( workPackage.props && workPackage.props[ MBC_IS_READ_ONLY ] ) {
            isReadOnlyMode = workPackage.props[ MBC_IS_READ_ONLY ].uiValues[ 0 ] === 'True';
            if( isReadOnlyMode === true && loadResponse.relatedObjectsMap[ collaborationContextUid ] ) {
                let readOnlyModeCaptionData = {
                    selectedRevisionRule: '',
                    SelectedPlanUnit: '',
                    selectedEndItem: '',
                    viewOtherConfigurationReadOnlyText:''
                };
                if( workPackage.type === 'Mbc0InternalWorkPackage' ) {
                    readOnlyModeCaptionData.viewOtherConfigurationReadOnlyText = resource.viewOtherConfigurationReadOnlyText;
                } else{
                    const effectivityData = loadResponse.relatedObjectsMap[ collaborationContextUid ].additionalPropertiesMap2;
                    readOnlyModeCaptionData = {
                        selectedRevisionRule: effectivityData.revisionRule[ 0 ],
                        SelectedPlanUnit: '',
                        selectedEndItem: ''
                    };
                    if( effectivityData.effectivityDate && effectivityData.effectivityDate[ 0 ] ) {
                        readOnlyModeCaptionData.SelectedPlanUnit = effectivityData.effectivityDate[ 0 ];
                    } else if( effectivityData.unitNumber && effectivityData.unitNumber[ 0 ] ) {
                        readOnlyModeCaptionData.SelectedPlanUnit = effectivityData.unitNumber[ 0 ] + ' |';
                    }
                    if( effectivityData.endItem && effectivityData.endItem[ 0 ] ) {
                        readOnlyModeCaptionData.selectedEndItem = effectivityData.endItem[ 0 ];
                    }
                }
                return readOnlyModeCaptionData;
            }
        }
    }
}

/**
 * Update tc platform version in tcSessionData.
 * Sync command should be visible only for version >= TC12.4.0.1
 */
export function updatePlatformVersion() {
    const phase = tcSvrVer.phase;
    if( phase ) {
        let stringArray = phase.split( '_' );
        if( stringArray !== null && stringArray.length >= 2 ) {
            const str = stringArray[ 0 ];
            const phaseVersion = parseInt( str, 10 );
            if( phaseVersion >= 10 ) {
                appCtxService.updatePartialCtx( 'tcSessionData.phaseVersion', phaseVersion );
            }
        }
    }
}

/**
 * Destroy
 */
export function destroy() {
    // Don't destroy if never been initialized
    if( !isInitialized ) {
        return;
    }
    eventBus.publish( 'cdm.cleanCache', {} );
    let currentStateName = AwStateService.instance.current.name;
    let currentStateParent = AwStateService.instance.current.parent;
    // Don't destroy if EP State
    if( EP_STATES.includes( currentStateName ) || EP_STATES.includes( currentStateParent ) ) {
        return;
    }

    isInitialized = false;
    //======End Validation======

    unSubscribeEvents.forEach( subDef => {
        eventBus.unsubscribe( subDef );
    } );
    epStructureConfigurationService.destroy();
    mfeVMOLifeCycleSvc.destroy();
    appCtxService.updatePartialCtx( 'objectQuotaContext.useObjectQuota', originalUseObjectQuotaValue );
    appCtxService.unRegisterCtx( 'ep.mcnObject' );
    appCtxService.unRegisterCtx( 'tcSessionData.phaseVersion' );
    resetEpContext();
    if( imanObjectTypePolicyId ) {
        propertyPolicySvc.unregister( imanObjectTypePolicyId );
    }
    appCtxService.unRegisterCtx( EP_TASK_PAGE_CONTEXT );
}

const epInitializationService = {

    init,
    loadModel,
    loadCCStructures,
    resetEpContext,
    initializeEPPage,
    getReadOnlyByEffectivityCaptionData,
    updatePlatformVersion,
    destroy,
    updateTaskPageContext,
    updatePlantStructureInfo,
    updateTaskPageName,
    updateConfigurationFlagInfo
};
export default epInitializationService;
