// Copyright (c) 2022 Siemens

/**
 * Service for ep structure configuration
 *
 * @module js/epStructureConfigurationService
 */

import appCtxService from 'js/appCtxService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import eventBus from 'js/eventBus';
import AwStateService from 'js/awStateService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdmSvc from 'soa/kernel/clientDataModel';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import dateTimeService from 'js/dateTimeService';
import preferenceService from 'soa/preferenceService';
import epNavigationService from 'js/epNavigationService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import endItemUnitEffectivityService from 'js/endItemUnitEffectivityConfigurationService';

const ACE_ACTIVE_CONTEXT_KEY = 'aceActiveContext.key';

/**
 * Get context info from active context
 *
 * @param {Object} activeContext activeContext
 * @param {Object} panelContextData panelContextData
 * @param {Boolean} skipReloadOnConfigParamChange should automatic page update/ reload occur after updating config params
 */
function updateConfigurationFilterPanelData( activeContext, panelContextData, skipReloadOnConfigParamChange = true ) {
    let pciObject = activeContext.context.productContextInfo;
    let supportedFeatures = null;
    let panelData = {
        viewKey: activeContext.key,
        productContextInfo: pciObject,
        elementToPCIMapCount: activeContext.context.elementToPCIMapCount,
        skipReloadOnConfigParamChange: skipReloadOnConfigParamChange
    };
    if( activeContext.context.supportedFeatures ) {
        supportedFeatures = activeContext.context.supportedFeatures;
    } else if( pciObject && pciObject.props ) {
        supportedFeatures = occMgmtStateHandler.getSupportedFeaturesFromPCI( pciObject );
    }

    if( !panelContextData.getValue().topElement && activeContext.context.topElement ) {
        panelData.topElement = activeContext.context.topElement;
    }
    panelData.supportedFeatures = supportedFeatures;
    mfeViewModelUtils.mergeValueInAtomicData( panelContextData, panelData );
}

/**
 * Init Occurrence Management to populate Configuration panel when opened, subscribe to events
 */
function initialize() {
    occMgmtStateHandler.initializeOccMgmtStateHandler();
}

/**
 * Cancel Configuration
 */
function cancelConfiguration() {
    // clear the config context from the ACE Active context
    const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
    appCtxService.updatePartialCtx( aceActiveContextKey + '.configContext', {} );
    epNavigationService.closeSideNavPanel();
}

/**
 * Put the structure context in ctx
 *
 * @param {String} pciUid the pciUid to put its structure context in ctx
 * @param {String} ctxStructureContextName the structure context name to put in ctx
 *                                         i.e. 'processStructureContext'/ 'mbomStructureContext'
 * @param {String} structureKey the ctx key name of the current structure which is configured
 * @param {String} configFilterPanelTitle the configuration panel title
 * @param { String } configFlagContextName key name for epTaskPageContext, to get excluded flags details
 * @param { String } scopeKey the ctx key name of the current scope of the structure which is configured
 * @param {String} topElement the top element that is being configured
 * @return {Boolean} true in context set otherwise false
 */
function setCtxStructureContext( pciUid, ctxStructureContextName, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement ) {
    if( pciUid ) {
        const pciModelObject = cdmSvc.getObject( pciUid );
        const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
        const configFlagContext = epTaskPageContext[ configFlagContextName ];

        let contextOfStructure = appCtxService.getCtx( ctxStructureContextName );
        let topElementToSetInCtx = contextOfStructure ? contextOfStructure.topElement : null;
        if( !topElementToSetInCtx ) {
            topElementToSetInCtx = topElement;
        }
        const ctxStructureContext = Object.assign( {},
            appCtxService.getCtx( ctxStructureContextName ), {
                productContextInfo: pciModelObject,
                structureKey: structureKey,
                configFilterPanelTitle: configFilterPanelTitle,
                scopeKey: scopeKey,
                excludedFlagsState: {
                    epExcludedByEffectivity: configFlagContext.show_unconfigured_effectivity && configFlagContext.show_unconfigured_effectivity[ 0 ] === 'true',
                    epShowExcludedAssignments: configFlagContext.show_unconfigured_assignment && configFlagContext.show_unconfigured_assignment[ 0 ] === 'true',
                    epShowExcludedByVariant: configFlagContext.show_unconfigured_variants && configFlagContext.show_unconfigured_variants[ 0 ] === 'true'
                },
                topElement: topElementToSetInCtx
            }
        );
        appCtxService.updatePartialCtx( ctxStructureContextName, ctxStructureContext );
        activateAceStructureContext( ctxStructureContextName );
        return true;
    }

    return false;
}

/**
 * activate structure context as ACE Active Context
 *
 * @param {String} pciUid the uid of  PCI  i.e. 'processPCI', ebomPCI 'mbomPCI'etc
 * @param {String} contextKey the StructureContext name to activate
 *                            i.e. 'processStructureContext'/ 'mbomStructureContext'
 * @param {String} structureKey the ctx key name of the current structure which is configured
 * @param {String} configFilterPanelTitle the configuration panel title
 * @param { String } configFlagContextName key name for epTaskPageContext, to get excluded flags details
 * @param { String } scopeKey the ctx key name of the current scope of the structure which is configured,
 * can be sub process of process structure, can be empty if not relevant
 * @param {String} topElement the top element that is being configured
 *
 * @returns {Object} loaded runtime configuration
 */
function activateStructureContext( pciUid, contextKey, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement ) {
    if( pciUid ) {
        const structure = appCtxService.getCtx( structureKey );
        const loadedObjectUid = structure.uid;
        const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( [ 'RuntimeConfiguration' ], loadedObjectUid, null, null, null );
        return epLoadService.loadObject( loadTypeInputs, false ).then(
            function() {
                return setCtxStructureContext( pciUid, contextKey, structureKey, configFilterPanelTitle, configFlagContextName, scopeKey, topElement );
            } );
    }

    return Promise.resolve( false );
}

/**
 * activate ACE Active Context
 *
 * @param {String} contextKey the StructureContext name to activate
 *                            i.e. 'processStructureContext'/ 'mbomStructureContext'
 */
function activateAceStructureContext( contextKey ) {
    const structureContext = appCtxService.getCtx( contextKey );
    if( structureContext ) {
        appCtxService.registerCtx( 'aceActiveContext', {
            key: contextKey,
            context: structureContext
        } );

        const eventData = {
            contextKey: contextKey
        };
        eventBus.publish( 'occDataLoadedEvent', eventData );
    }
}

/**
 * Get the related objects to pass as input to save soa call
 *
 * @param {Object} loadedStructure the loaded configuration structure
 *
 * @returns {ObjectArray} relatedObjects
 */
function getRelatedObjects( loadedStructure ) {
    const relatedObjects = [];
    const relModelObject = {
        uid: loadedStructure.uid,
        type: loadedStructure.type
    };
    relatedObjects.push( relModelObject );

    const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
    const structureContext = appCtxService.getCtx( aceActiveContextKey );
    relatedObjects.push( structureContext.productContextInfo );
    return relatedObjects;
}

/**
 *
 * @param {*} configData configData
 */
function clearConfigData( configData ) {
    if( configData ) {
        configData.update( { isBaseViewVisible: true } );
    }
}

/**
 *
 * @param {Object} configData  configData
 * @param {Object} updatedValues updatedValues
 * @param {String} modifiedProp updatedValues
 */
function updateConfigData( configData, updatedValues, modifiedProp ) {
    if( configData && updatedValues && modifiedProp === 'eg_uids' ) {
        mfeViewModelUtils.mergeValueInAtomicData( configData, updatedValues );
    }
}
/**
 * Get the change in configuration panel to pass as input to save soa call
 *
 * @param {Object} configData the changed configuration data
 *
 * @returns {Object} configChange
 */
function getConfigurationToSave( configData ) {
    const configChange = {};

    if( configData.effectivityDate ) {
        configChange.effDate = dateTimeService.formatUTC( configData.effectivityDate );
    }
    if( configData.endItemUid ) {
        configChange.endItem = configData.endItemUid;
    } else {
        setDefaultEndItem( configChange );
    }
    if( configData.effectiveUnit ) {
        configChange.unitNo = [ configData.effectiveUnit.toString() ];
    }
    if( configData.revisionRule ) {
        configChange.revisionRule = configData.revisionRule;
    }
    if( configData.effectivityGroups ) {
        configChange.effGroup = configData.effectivityGroups;
    }
    if( configData.variantRule ) {
        configChange.variantRule = configData.variantRule;
    } else if( configData.variantRule === null ) {
        configChange.variantRule = [ '' ];
    }
    if( configData.variantRuleOwningRev ) {
        configChange.variantItemUid = [ configData.variantRuleOwningRev ];
    }
    if( configData.closureRule ) {
        configChange.closureRule = [ configData.closureRule ];
    }
    if( configData.showExcludedByEffectivity || configData.showExcludedByEffectivity === false ) {
        configChange.toggleShowUnconfigEff = configData.showExcludedByEffectivity ? 'true' : 'false';
    }
    if( configData.showExcludedByVariant || configData.showExcludedByVariant === false ) {
        configChange.toggleShowVariants = configData.showExcludedByVariant ? 'true' : 'false';
    }
    if( configData.showExcludedAssignments || configData.showExcludedAssignments === false ) {
        configChange.toggleShowAssignedOcc = configData.showExcludedAssignments ? 'true' : 'false';
    }
    if( configData.saveConfigurationToWP || configData.saveConfigurationToWP === false ) {
        configChange.toggleSaveConfigToCC = configData.saveConfigurationToWP ? 'true' : 'false';
    }

    return configChange;
}

/**
 * Set end item from the context if it wasn't set by user in  the dialog
 * @param {Object} configChange the changed configuration data
 */
function setDefaultEndItem( configChange ) {
    //get end item saved in context
    const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
    const aceActiveContext = appCtxService.getCtx( aceActiveContextKey );
    var endItem = endItemUnitEffectivityService.getEndItemFromProductContextInfo( aceActiveContext );
    if( endItem ) {
        var endItemUID = endItem.uid;
        if( !endItemUID && endItem.dbValues ) {
            endItemUID = endItem.dbValues[ 0 ];
        }
        configChange.endItem = endItemUID;
    }
}

/**
 * returns true if any setting is defined in the config data, otherwise returns false.
 *
 * @param {*} configData config data as selected by the user
 * @returns {boolean} returns true if any setting is defined in the config data, otherwise returns false.
 */
function isDirty( configData ) {
    let updatedValues = configData.getValue();
    let isConfigChanged = updatedValues && ( updatedValues.endItemUid || updatedValues.effectiveUnit || updatedValues.effectivityDate || updatedValues.revisionRule ||
        updatedValues.effectivityGroups || ( updatedValues.variantRule || updatedValues.variantRule === null ) || updatedValues.variantRuleOwningRev || updatedValues.closureRule ||
        ( updatedValues.showExcludedByVariant || updatedValues.showExcludedByVariant === false ) ||
        ( updatedValues.showExcludedByEffectivity || updatedValues.showExcludedByEffectivity === false ) ||
        ( updatedValues.showExcludedAssignments || updatedValues.showExcludedAssignments === false ) ||
        ( updatedValues.saveConfigurationToWP || updatedValues.saveConfigurationToWP === false ) );

    return Boolean( isConfigChanged );
}

/**
 * Call epSaveService to save all the changes
 *
 * @param {Object} configData the changed configuration data
 *
 * @returns {Object} saveResponse
 */
function saveChanges( configData ) {
    if( isDirty( configData ) ) {
        const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
        const aceActiveContext = appCtxService.getCtx( aceActiveContextKey );
        const loadedStructure = appCtxService.getCtx( aceActiveContext.scopeKey ? aceActiveContext.scopeKey : aceActiveContext.structureKey );
        const targetAsm = {
            id: [ loadedStructure.uid ]
        };

        const saveWriter = saveInputWriterService.get();
        let upadtedCongigChanges =  getConfigurationToSave( configData );
        saveWriter.addConfigurationChangeEntry( targetAsm, upadtedCongigChanges );
        return epSaveService.saveChanges( saveWriter, false, getRelatedObjects( loadedStructure ), true ).then( function( appliedConfig ) {
            let pciType = getAppliedConfigType( appliedConfig );

            let updatedConfigFlag = {
                toggleShowUnconfigEff: upadtedCongigChanges.toggleShowUnconfigEff,
                toggleShowVariants: upadtedCongigChanges.toggleShowVariants,
                showExcludedAssignments: upadtedCongigChanges.showExcludedAssignments,
                toggleSaveConfigToCC: upadtedCongigChanges.toggleSaveConfigToCC };
            Object.keys( updatedConfigFlag ).forEach( key => updatedConfigFlag[key] === undefined && delete updatedConfigFlag[key] );
            return { appliedConfig:appliedConfig, appliedConfigType:pciType, updatedConfigFlag: updatedConfigFlag };
        } );
    }
    return Promise.resolve( null );
}
/**
 *
 * @param {Object} appliedConfig  appliedConfig
 * @returns {String} applied configType;
 */
function getAppliedConfigType( appliedConfig ) {
    let appliedConfigType;
    appliedConfig.saveEvents.forEach( ( saveEvent ) => {
        if( saveEvent.eventType === epSaveConstants.CREATE_EVENT ) {
            // The mbom & product might have the same PCI object
            saveEvent.eventData.forEach( ( param ) => {
                if( param === 'processPCI' || param === 'productPCI' || param === 'ebomPCI' || param === 'mbomPCI' ||
                    param === 'productionProgramPCI' || param === 'plantPCI' || param === 'functionalPlanPCI' ) {
                    appliedConfigType = param;
                    return true;
                }
            } );
        }
    } );

    return appliedConfigType;
}
/**
 * Call handleResponseAndRedirect in case an error and there is no response (the root was configure out)
 * Then move to another page either bop breakdown planing or manage page
 *
 * @param {Object} saveResponse The response we got from the server
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 *
 */
function handleResponseAndRedirect( saveResponse, shouldUpdatePciParam ) {
    let toParams = {};
    // There are save events and there are errors or at least one
    if( saveResponse.saveEvents && saveResponse.saveEvents.length > 0 ) {
        let url = handleSaveEvents( saveResponse, shouldUpdatePciParam );
        let searchParams = url.searchParams;
        searchParams.forEach( ( value, key ) => {
            toParams[ key ] = value;
        } );
    } else {
        let loc = window.location.href;
        loc = loc.replace( '#', '/' );
        loc = loc.replaceAll( '~2F', '/' );

        let url = new URL( loc );

        // Get the url parameters
        let searchParams = url.searchParams;
        searchParams.forEach( ( value, key ) => {
            toParams[ key ] = value;
        } );
    }

    const options = {
        inherit: true,
        reload: true
    };

    // Check the preference if there is highLevelPlanning
    preferenceService.getLogicalValue( 'EP_PlanningForSmallProduct' ).then(
        function( result ) {
            // if there is a preference and TRUE it means the task is invisible .
            // Therefor we will go back to the manage page
            if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                let ccuid = appCtxService.getCtx( 'ep.loadedCCObject.uid' );
                toParams.uid = ccuid;
                AwStateService.instance.go( 'manageWorkPackageNew', toParams, options );
            } else {
                // The preference is false or does not exists go back to breakdown page
                toParams.uid = appCtxService.getCtx( 'epTaskPageContext.processStructure.uid' );
                AwStateService.instance.go( 'highLevelPlanning', toParams, options );
            }
        } );
}

/**
 * Handle save events
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 *
 * @returns {Object} url
 */
function handleSaveEvents( saveResponse, shouldUpdatePciParam ) {
    let loc = window.location.href;
    loc = loc.replace( '#', '/' );
    loc = loc.replaceAll( '~2F', '/' );

    let url = new URL( loc );

    // Get the url parameters
    let searchParams = url.searchParams;
    if( AwStateService.instance.current.name !== 'manageWorkPackageNew' ) {
        const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
        if( !loc.includes( 'processPCI' ) && epTaskPageContext.processPCI ) {
            searchParams.set( 'processPCI', epTaskPageContext.processPCI.uid );
        }
        if( !loc.includes( 'productPCI' ) && epTaskPageContext.productPCI ) {
            searchParams.set( 'productPCI', epTaskPageContext.productPCI.uid );
        }
        if( !loc.includes( 'ebomPCI' ) && epTaskPageContext.ebomPCI ) {
            searchParams.set( 'ebomPCI', epTaskPageContext.ebomPCI.uid );
        }
        if( !loc.includes( 'mbomPCI' ) && epTaskPageContext.mbomPCI ) {
            searchParams.set( 'mbomPCI', epTaskPageContext.mbomPCI.uid );
        }
        if( !loc.includes( 'plantPCI' ) && epTaskPageContext.plantPCI ) {
            searchParams.set( 'plantPCI', epTaskPageContext.plantPCI.uid );
        }
    }
    if( shouldUpdatePciParam ) {
        saveResponse.saveEvents.forEach( ( saveEvent ) => {
            if( saveEvent.eventType === epSaveConstants.CREATE_EVENT ) {
                // The mbom & product might have the same PCI object
                saveEvent.eventData.forEach( ( param ) => {
                    if( param === 'processPCI' || param === 'productPCI' || param === 'ebomPCI' || param === 'mbomPCI' ||
                        param === 'productionProgramPCI' || param === 'plantPCI' || param === 'functionalPlanPCI' ) {
                        // Update the url param value
                        searchParams.set( param, saveEvent.eventObjectUid );
                    }
                    // this function will get called in case of reset configuration, on EBOM-MBOM Alignmnet page they use CC id as a scope and not the process
                    else if( param === 'processStructure' && appCtxService.getCtx( 'sublocation' ).nameToken !== 'multiBOMManager:taskPageSubLocation' ) {
                        searchParams.set( 'uid', saveEvent.eventObjectUid );
                    }
                } );
            }
        } );
    }
    url.search = searchParams.toString();
    return url;
}

/**
 * Process the configuration change save response
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 */
function handleResponse( saveResponse, shouldUpdatePciParam ) {
    if( saveResponse.saveEvents && saveResponse.saveEvents.length > 0 && ( !saveResponse.ServiceData || !saveResponse.ServiceData.partialErrors ) ) {
        handleSaveAndRedirect( saveResponse, shouldUpdatePciParam );
    } else {
        // There is no save response either the root configure out or the current scope in work instruction, assembly planning.
        // Therefore change the location from the application to bopbreakdown
        handleResponseAndRedirect( saveResponse, shouldUpdatePciParam );
    }
}

/**
 * handleSaveAndRedirect taking care of the response and save and then redirect to the same page.
 * The reason for redirect is for refresh and load the data with the new configuration.
 * We are sending the new parameters for update in the URL
 *
 * @param {Object} saveResponse the save response
 * @param { Boolean } shouldUpdatePciParam whether to update PCI param in the uRL or not, like on manage work package we should not add them.
 */
function handleSaveAndRedirect( saveResponse, shouldUpdatePciParam ) {
    let url = handleSaveEvents( saveResponse, shouldUpdatePciParam );

    // The new url string
    let newUrl = url.toString();
    newUrl = newUrl.replace( '///', '/#/' );

    // Reload the window with the new URL
    window.location.assign( newUrl );
    const subLocationName = appCtxService.getCtx( 'sublocation' ).nameToken;
    if( subLocationName === 'highLevelPlanning' ) {
        AwStateService.instance.reload();
    }
    window.location.reload();
}

/**
 * Call epSaveService to save all the changes configuration flags
 *
 * @param {Object} topObject the top object
 * @param {String} ConfigurationFlag config flag name
 * @param { String } isManageWorkPackagePage to decide whether to update PCI param in the URL or not, on manage work package we should not add them.
 *
 * @returns {Object} saveResponse
 */
function saveConfigurationFlags( topObject, ConfigurationFlag, isManageWorkPackagePage ) {
    const saveWriter = saveInputWriterService.get();
    let configFlag = {
        [ `${ConfigurationFlag}` ]: [ 'true' ]
    };

    let shouldUpdatePciParam = true;
    if( isManageWorkPackagePage && isManageWorkPackagePage === 'true' ) {
        shouldUpdatePciParam = false;
    }
    const stateParams = AwStateService.instance.params;
    if( stateParams && stateParams.uid && cdmSvc.getObject( stateParams.uid ).modelType.typeHierarchyArray.includes( epBvrConstants.IMAN_ITEM_BOP_LINE ) ) {
        configFlag.currentScope = stateParams.uid;
    }

    saveWriter.addConfigurationChangeEntry( { id: topObject.uid }, configFlag );
    return epSaveService.saveChanges( saveWriter, false, [ topObject ], true ).then( function( saveResponse ) {
        if( !saveResponse.ServiceData || !saveResponse.ServiceData.partialErrors ) {
            handleSaveAndRedirect( saveResponse, shouldUpdatePciParam );
        }
        return Promise.resolve( saveResponse );
    } );
}

/**
 * Get the configuration filter panel title
 *
 * @returns {String} title
 */
function getConfigFilterPanelTitle() {
    const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
    const aceActiveContext = appCtxService.getCtx( aceActiveContextKey );
    return aceActiveContext.configFilterPanelTitle;
}

/**
 * Set excluded flags status based on existing configuration. This method is get called while loading the configuration panel.
 *
 * @returns {Object} excluded flags status true/false
 */
function setExcludedFlagsStatus() {
    const aceActiveContextKey = appCtxService.getCtx( ACE_ACTIVE_CONTEXT_KEY );
    const aceActiveContext = appCtxService.getCtx( aceActiveContextKey );
    const configFlagContext = aceActiveContext.excludedFlagsState;
    let epExcludedByEffectivity = false;
    let epShowExcludedAssignments = false;
    let epShowExcludedByVariant = false;

    if( configFlagContext ) {
        if( configFlagContext.epExcludedByEffectivity ) {
            epExcludedByEffectivity = configFlagContext.epExcludedByEffectivity;
        }
        if( configFlagContext.epShowExcludedAssignments ) {
            epShowExcludedAssignments = configFlagContext.epShowExcludedAssignments;
        }
        if( configFlagContext.epShowExcludedByVariant ) {
            epShowExcludedByVariant = configFlagContext.epShowExcludedByVariant;
        }
    }
    return {
        epExcludedByEffectivity,
        epShowExcludedAssignments,
        epShowExcludedByVariant
    };
}

export default {
    initialize,
    updateConfigurationFilterPanelData,
    clearConfigData,
    updateConfigData,
    cancelConfiguration,
    activateStructureContext,
    saveChanges,
    getConfigFilterPanelTitle,
    saveConfigurationFlags,
    handleResponse,
    setExcludedFlagsStatus,
    isDirty
};
