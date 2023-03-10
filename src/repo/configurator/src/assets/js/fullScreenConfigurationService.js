// Copyright (c) 2022 Siemens

/**
 *
 * @module js/fullScreenConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import editHandlerFactory from 'js/editHandlerFactory';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import Pca0IncompleteFamiliesService from 'js/Pca0IncompleteFamiliesService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

var m_editHandler;
var m_saveHandler;
var FSC_SAVE_COMMAND = 'save';
var FSC_SAVEAS_COMMAND = 'saveAs';

/**
 * This method used to initialize the command panel in fsc for Save/SaveAs and set
 * title and button title dynamically, according to command
 * @param {Object} data View Data
 * @returns {Object} return the name of Panel Title
 */
export let initSaveOrSaveAsPanel = function( data ) {
    let panelContext = appCtxSvc.getCtx( 'panelContext' );
    let panelTitle;
    if( _.isEqual( panelContext.panelTitle, FSC_SAVE_COMMAND ) ) {
        panelTitle = data.i18n.saveCmd;
    } else if( _.isEqual( panelContext.panelTitle, FSC_SAVEAS_COMMAND ) ) {
        panelTitle = data.i18n.saveAsCmd;
    }
    return { title: panelTitle };
};

/**
 * initialize edit handler for varints tab
 * @param {Object} fscState fscState atomic data
 */
let initializeEditHandler = function( fscState ) {
    // Edit Handler
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let declVM = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );
    declVM.fscState = fscState;
    m_editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declVM
        } ) );

    // Add new method to identify editing context
    m_editHandler.getEditHandlerContext = function() {
        return Pca0Constants.FSC_CONTEXT;
    };

    editHandlerService.setEditHandler( m_editHandler, 'VARIANT_FSC_CONTEXT' );
    editHandlerService.setActiveEditHandlerContext( 'VARIANT_FSC_CONTEXT' );

    // Save Handler
    m_saveHandler = {
        isDirty: function( dataSource ) {
            var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
            let fscState;
            var isDirty = false;
            if( dataSource && dataSource.getDeclViewModel() ) {
                let vmData = dataSource.getDeclViewModel();
                fscState = vmData.fscState;
            }
            if( fscState && fscState.getAtomicData() ) {
                isDirty = fscState.getAtomicData().variantRuleDirty;
            }
            return fscContext ? fscContext.isVCVOpenedFromConfigurator && isDirty : false;
        },
        saveEdits: function() {
            return saveVariantExpressions();
        }
    };
    m_editHandler.startEdit();
};

/**
 * Return Save Handler for active Edit Context
 * @return {Object} Save Handler
 */
export let getSaveHandler = function() {
    return m_saveHandler;
};

/**
 * Save selected VR in variants TAB
 */
export let saveVariantExpressions = function() {
    var varContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var eventData = {
        variantRule: varContext.initialVariantRule,
        selectedCtx: Pca0Constants.FSC_CONTEXT
    };
    eventBus.publish( 'Pca0FullScreenConfiguration.updateVariantRule', eventData );
};

var exports = {};

/** default Preference Value  */
var CFG0_CREATEVARIANTRULETYPE = 'VariantRule'; //NON-NLS-1
var synchronizeAppliedVRsEvent = null;
var subLocationContentSelectionChangeEvent = null;
var processPartialErrorEvent = null;

/**
 * Handle window resize event in FSC
 * @param {Object} fscState fscState atomic data
 */
function handleFSCResize( fscState ) {
    if( !fscState || fscState.getAtomicData() === undefined ) {
        return;
    }
    var newFscState = { ...fscState.getAtomicData() };
    var newIsHorizontalLayout = newFscState.isHorizontalLayout;
    if( window.innerWidth <= 1000 && newFscState.isHorizontalLayout ) {
        newIsHorizontalLayout = false;
    } else if( window.innerWidth > 1000 && !newFscState.isHorizontalLayout ) {
        newIsHorizontalLayout = true;
    }
    if( newIsHorizontalLayout !== newFscState.isHorizontalLayout ) {
        // Update context and fire event if layout actually changed
        newFscState.isHorizontalLayout = newIsHorizontalLayout;
        fscState.setAtomicData( newFscState );
    }
}

/**
 * Toggle the summary button
 */
export let toggleShowSummaryPanel = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( context ) {
        if( context.showSummary === undefined ) {
            context.showSummary = false;
        } else {
            context.showSummary = !context.showSummary;
        }
    }
};

export let getSelectionForVariantContext = function( context ) {
    return configuratorUtils.getSelectionForVariantContext( context );
};

/**
 * This API returns initialVariantRule only when selections are undefined
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function( variantRuleData ) {
    return configuratorUtils.getFscActiveVariantRules( variantRuleData );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @returns {Object} ConfigPerspective - Returns the config perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * Return Profile Settings information
 * @returns {Object} Active Profile Settings for FSC
 */
export let getProfileSettingsForFsc = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * This API updates context with Active Profile Settings and Filter Criteria
 * Settings might derive from loaded SVR or default behavior (preference)
 * @param {Object} response - The response received by SOA service,
 * @param {Object} variantRuleData - The variantRuleData
 * @returns {Object} - Returns information on Applied Settings for the context
 */
export let initSettings = function( response, variantRuleData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var saveAsDefault = false;
    var newVariantRuleData = { ...variantRuleData.getAtomicData() };
    if( !newVariantRuleData.defaultConfigPerspective.uid && newVariantRuleData.useDefaultConfigPerspective ) {
        newVariantRuleData.defaultConfigPerspective = response.configPerspective;
        saveAsDefault = true;
    }
    newVariantRuleData.configPerspective = response.configPerspective;
    variantRuleData.setAtomicData( newVariantRuleData );

    var appliedSettings = {};

    // Filter Criteria are always returned
    var configSettings;
    if( response && response.responseInfo ) {
        configSettings = JSON.parse( response.responseInfo.configSettings[ 0 ] );
        appliedSettings.configSettings = configSettings;

        // Active Validation Mode
        var activeValidationProfile = JSON.parse( response.responseInfo.activeSolverProfileSettings[ 0 ] );
        // Localize for OOTB Overlay/Order and for Custom profiles
        configuratorUtils.localizeValidationProfileNames( activeValidationProfile );

        // Check if rule Date Translation Mode exists in response
        // NOTE- ruleDateTranslationMode will be available from tc14.1 releases only
        if( response.responseInfo.ruleDateTranslationMode && response.responseInfo.ruleDateTranslationMode[ 0 ] ) {
            // Set Rule Date Translation Mode
            appliedSettings.ruleDateTranslationMode = response.responseInfo.ruleDateTranslationMode[ 0 ];
        }

        if( fscContext.initialVariantRule && activeValidationProfile.pca0ProfileName === 'pca0Custom' ) {
            var notificationMessage =
                configuratorUtils.getFscLocaleTextBundle().profileSettingsNotMatchingLoadingCustom.replace(
                    '{0}', fscContext.initialVariantRule.props.object_string.dbValue );
            configuratorUtils.showNotificationMessage( notificationMessage, 'WARNING' );
        }
        appliedSettings.validationProfile = activeValidationProfile;
        fscContext.appliedSettings = appliedSettings;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        eventBus.publish( 'Pca0FullScreenConfiguration.activeSettingsLoaded' );
    }
    //save the applied settings as default so they can be retrieved as default perspective reinstated
    if( fscContext && saveAsDefault ) {
        fscContext.defaultAppliedSettings = _.cloneDeep( appliedSettings );
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    }

    return appliedSettings;
};

/**
 * Handle Apply Configuration
 * @param {Object} commandContext containing selection atomic data
 */
export let handleFSCConfiguration = function( commandContext ) {
    //Close the package panel first
    eventBus.publish( 'Pca0FSCPackage.closePanel', {} );

    let variantRuleDirty = false;

    if( commandContext.fscState && commandContext.fscState.getAtomicData ) {
        variantRuleDirty = commandContext.fscState.getAtomicData().variantRuleDirty;
    } else if( commandContext.fscState && commandContext.fscState.value ) {
        variantRuleDirty = commandContext.fscState.value.variantRuleDirty;
    }
    const fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( variantRuleDirty || fscContext.initialVariantRule === undefined ) {
        eventBus.publish( 'Pca0FullScreenConfiguration.applyConfiguration', {
            conditionFlag: 'false'
        } );
    } else {
        const customRule = fscContext.customVariantRule;
        let ruleUid;
        if( fscContext.initialVariantRule && fscContext.initialVariantRule.uid ) {
            ruleUid = fscContext.initialVariantRule.uid;
        } else if( customRule && customRule.uid ) {
            ruleUid = customRule.uid;
        }

        if( ruleUid ) {
            eventBus.publish( 'Pca0FullScreenConfiguration.configureContent', {
                variantRules: [ ruleUid ]
            } );
        }
    }
};

/**
 * This method used to activate the command panel in fsc to save new svr/Variant Criteria or
 * update the saved svr/Variant Criteria.
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} commandContext command context of the panel
 */
export let fscActivateCommandPanel = function( commandId, location, commandContext ) {
    let getPreference = appCtxSvc.getCtx( 'preferences' );
    var panelContext = { ...commandContext, panelTitle: FSC_SAVE_COMMAND };
    let varContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    varContext.createVariantPreference = CFG0_CREATEVARIANTRULETYPE;
    if( getPreference.Cfg0CreateVariantRuleType && !_.isEmpty( getPreference.Cfg0CreateVariantRuleType[ 0 ] ) ) {
        varContext.createVariantPreference = getPreference.Cfg0CreateVariantRuleType[ 0 ];
    }
    //the event will call server funct which taps into the value of the fscContext, make sure to update it
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, varContext );

    if( !varContext.initialVariantRule || varContext.initialVariantRule.props.object_string.dbValue === configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
        commandPanelService.activateCommandPanel( commandId, location, panelContext );
    } else {
        var eventData = {
            variantRule: varContext.initialVariantRule,
            selectedCtx: Pca0Constants.FSC_CONTEXT
        };
        eventBus.publish( 'Pca0FullScreenConfiguration.updateVariantRule', eventData );
    }
};

/**
 * This method used to activate the command panel in fsc to save current svr with new name
 * @param {String} commandId panel id to activate the command panel
 * @param {String} location location name
 * @param {Object} commandContext command context of the panel
 */
export let fscActivateSaveAsCommandPanel = function( commandId, location, commandContext ) {
    let getPreference = appCtxSvc.getCtx( 'preferences' );
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var panelContext = { ...commandContext, panelTitle: FSC_SAVEAS_COMMAND };
    fscContext.createVariantPreference = CFG0_CREATEVARIANTRULETYPE;
    if( getPreference.Cfg0CreateVariantRuleType && !_.isEmpty( getPreference.Cfg0CreateVariantRuleType[ 0 ] ) ) {
        fscContext.createVariantPreference = getPreference.Cfg0CreateVariantRuleType[ 0 ];
    }
    commandPanelService.activateCommandPanel( commandId, location, panelContext );
};

/**
 * Initialize fscContext with syncObject data
 * @returns {Boolean} return true if input flag isVCVOpenedFromConfigurator value is true, else return false
 */
export let isVCVOpenedFromConfigurator = function() {
    // isVCVOpenedFromConfigurator flag to identify if VCV is opened from Configurator Context
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    let _isVCVOpenedFromConfigurator = false;
    let selectedVR = '';
    if( configuratorCtx && !_.isUndefined( configuratorCtx.variantRuleData ) ) {
        const isVCVOpenedFromConfigurator = configuratorCtx.variantRuleData.isVCVOpenedFromConfigurator;
        // if this flag is true, assign the value to local variable
        if( isVCVOpenedFromConfigurator ) {
            _isVCVOpenedFromConfigurator = isVCVOpenedFromConfigurator;
        }
        selectedVR = configuratorCtx.variantRuleData.selectedObjects[ 0 ].uid;
    }
    return { _isVCVOpenedFromConfigurator, selectedVR };
};

/**
 * Initialize Full Screen Configuration Page
 *Re-initialize atomic Data in case VCV is being reloaded
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @param {Object} vcvReloadingEventData - the vcvReload event Info container
 */
export let initFSCConfiguration = function( fscState, variantRuleData, vcvReloadingEventData ) {
    var newFscState = { ...fscState.getAtomicData() };
    var newVariantRuleData = { ...variantRuleData.getAtomicData() };

    // initialize fscContext with input data
    let { _isVCVOpenedFromConfigurator, selectedVR } = exports.isVCVOpenedFromConfigurator();

    let currentAppliedVRs;
    let selectedModelObjects;
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Do not unregister fscContext if view is being reloaded.
    // This would cause Pca0Summary view to be destroyed and exception when onMountedInitializer is called on reloadVCV
    if( fscContext && _.isUndefined( vcvReloadingEventData ) ) {
        currentAppliedVRs = fscContext.currentAppliedVRs;
        if( !newFscState.isSwitchingFromGridToListView ) {
            appCtxSvc.unRegisterCtx( Pca0Constants.FSC_CONTEXT );
        }
        selectedModelObjects = fscContext.selectedModelObjects;
    }
    if( _isVCVOpenedFromConfigurator && !_.isEmpty( selectedVR ) ) {
        let uids = [ selectedVR ];
        currentAppliedVRs = uids;
        let modelContext = pca0ConfiguratorExplorerCommonUtils.getConfiguratorContextUID();
        selectedModelObjects = [ {
            uid: modelContext
        } ];
        appCtxSvc.unRegisterCtx( Pca0Constants.FSC_CONTEXT );
    }

    // FSC starts in Horizontal Mode
    // Check if other applications have set currentAppliedVariantRules
    if( currentAppliedVRs && currentAppliedVRs.length > 0 ) {
        if( newFscState.isSwitchingFromGridToListView ) {
            // if Variant Rule is already present, applied and when switching from grid view to list view, update fscContext
            // retain selectedExpressions and other context information
            newFscState.isHorizontalLayout = true;
            appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        } else {
            appCtxSvc.registerCtx( Pca0Constants.FSC_CONTEXT, {
                currentAppliedVRs: currentAppliedVRs,
                selectedModelObjects: selectedModelObjects,
                isVCVOpenedFromConfigurator: _isVCVOpenedFromConfigurator
            } );
            // if Variant Rule is already present and applied, synchronize the current VR
            exports.synchronizeAppliedVRs( fscState, variantRuleData );
            if( _isVCVOpenedFromConfigurator ) {
                initializeEditHandler( fscState );
            }
        }
    } else {
        // case 1: when variant configuration is reset, register new fscContext
        // case 2: when there is no Variant Rule applied, register new fscContext
        appCtxSvc.registerCtx( Pca0Constants.FSC_CONTEXT, { selectedModelObjects: selectedModelObjects } );
    }

    fscState.setAtomicData( newFscState );

    // unsubscribe event as FSC view is being loaded.
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( synchronizeAppliedVRsEvent ) {
        eventBus.unsubscribe( synchronizeAppliedVRsEvent );
    }
    synchronizeAppliedVRsEvent = eventBus.subscribe( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs', function() {
        exports.synchronizeAppliedVRs( fscState, variantRuleData );
    } );

    // unsubscribe event as FSC view is being loaded
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( subLocationContentSelectionChangeEvent ) {
        eventBus.unsubscribe( subLocationContentSelectionChangeEvent );
    }
    subLocationContentSelectionChangeEvent = eventBus.subscribe( 'AM.SubLocationContentSelectionChangeEvent', function( eventData ) {
        eventBus.publish( 'dataProvider.selectionChangeEvent', {
            selected: eventData.selections,
            source: 'secondaryWorkArea'
        } );
    } );

    // unsubscribe event as FSC view is being loaded
    // This is required to avoid duplicate Reload/Reset confirmation message.
    // As initFSCConfiguration method is being explicitly called from showListView method other than onMount lifecycle hook
    if( processPartialErrorEvent ) {
        eventBus.unsubscribe( processPartialErrorEvent );
    }
    processPartialErrorEvent = eventBus.subscribe( 'Pca0FullScreenConfiguration.processPartialError', function( eventData ) {
        pca0CommonUtils.processPartialErrors( eventData.ServiceData );
    } );

    //PLM711151: when starting in the context of occ management, there might be a variant selected already. We have to use it
    //TODO: we will have to replace this with a common variant location btw. fsc and occ man; for now this will work.
    //Note: we also did remove the other instance in fsc where we know the occ man path in the related PLM710995
    var occMgmtContext = appCtxSvc.getCtx( 'occmgmtContext' );
    fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( _.get( occMgmtContext, 'productContextInfo.props.awb0CurrentVariantRules.dbValues' ) && !newFscState.isSwitchingFromGridToListView &&
        !_.isEqual( fscContext.currentAppliedVRs, occMgmtContext.productContextInfo.props.awb0CurrentVariantRules.dbValues ) ) {
        let svrs = occMgmtContext.productContextInfo.props.awb0CurrentVariantRules.dbValues;
        fscContext.currentAppliedVRs = svrs;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        newVariantRuleData.useDefaultConfigPerspective = false;
        newVariantRuleData.variantRuleData = svrs;
        variantRuleData.setAtomicData( newVariantRuleData );

        // handle fscContext.currentAppliedVRs change
        // NOTE: this event is fired also when reloading FSC
        eventBus.publish( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs' );
    }
    // Handle Window resize event, with a threshold of 1000px
    window.addEventListener( 'resize', ( evt ) => handleFSCResize( fscState, evt ) );
};

/**
 * Destroy Full Screen Configuration Page
 */
export let destroyFSCConfiguration = function() {
    eventBus.unsubscribe( synchronizeAppliedVRsEvent );
    eventBus.unsubscribe( subLocationContentSelectionChangeEvent );
    eventBus.unsubscribe( processPartialErrorEvent );
    window.removeEventListener( 'resize', handleFSCResize );
    appCtxSvc.unRegisterCtx( Pca0Constants.FSC_CONTEXT );
};

/*
 * This method handles the change in Variant Rules from Configuration
 * @param {Object} fscState fscState atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 */
export let synchronizeAppliedVRs = function( fscState, variantRuleData ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let selectedVariant = null;
    /**
     * List view is not applicable when multiple variants or single variants with split expressions are loaded in Grid view.
     * Needs to switch back in list view when no variants selected as we dont allow to synch VR in Grid View
     */
    var newFscState = { ...fscState.getAtomicData() };
    var newVariantRuleData = { ...variantRuleData.getAtomicData() };
    if( newFscState.treeDisplayMode ) {
        return;
    }
    if( fscContext.currentAppliedVRs && fscContext.currentAppliedVRs[ 0 ] ) {
        selectedVariant = viewModelObjectService.createViewModelObject( fscContext.currentAppliedVRs[ 0 ] );
    }

    if( newVariantRuleData.configPerspective.uid === undefined ) {
        //This is the case when user is coming inside Variant configuration tab
        if( selectedVariant !== null ) {
            fscContext.initialVariantRule = selectedVariant;
        }
        if( selectedVariant === null || selectedVariant.props.object_string.dbValue !== configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
            //This is the case when user switches to Variant Configuration tab from other tabs in Secondary view
            eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVR' );
        }
    } else if( selectedVariant === null || selectedVariant.props.object_string.dbValue !== configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle ) {
        //This is the case when Variant configuration tab is already opened and we want to synch the variant rule change.
        //We do not want to synch a 'Custom Configuration', this is the case when user clicks on 'Apply Configuration' command.
        eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVR' );
    } else {
        //This is the case when user is inside the Variant Configuration tab and clicks on 'Apply Configuration' command
        //Do nothing
    }
};

/**
 * Processes the current variant change from occ man or any other place that changes it
 * @param {Object} eventData event info container for variantInfo selection change
 */
export let processVariantInfoChange = function( eventData ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( _.get( eventData, 'selectedObject' ) && ( !fscContext.currentAppliedVRs || fscContext.currentAppliedVRs[ 0 ] !== eventData.selectedObject.uid ) ) {
        fscContext.currentAppliedVRs = eventData.variantRules;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

        // handle fscContext.currentAppliedVRs change
        eventBus.publish( 'Pca0FullScreenConfiguration.synchronizeAppliedVRs' );
    }
};

/**
 * The method will pop up the switch Configuration Mode Confirmation to let the user decide to continue or abort in case of a dirty model
 * Note: this was moved here form json and it is a workaround for the currently thrown RangeError: Maximum call stack size exceeded
 * that hinders the pop up from displaying
 * @param {Object} fscState fscState atomic data
 * @param {Object} vcvReloadEventData info data container for VCV Reload event
 */
export let wipConfirmHandleSVRChange = function( fscState, vcvReloadEventData ) {
    var msg = configuratorUtils.getFscLocaleTextBundle().syncSVRChangeConfirmation;
    var cancelString = configuratorUtils.getFscLocaleTextBundle().cancel;
    var proceedString = configuratorUtils.getFscLocaleTextBundle().reload;
    if( !fscState || fscState.getAtomicData() === undefined ) {
        return;
    }
    var newFscState = { ...fscState.getAtomicData() };
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            newFscState.treeDisplayMode = true;
            fscState.setAtomicData( newFscState );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            if( !_.isUndefined( vcvReloadEventData ) ) {
                eventBus.publish( 'Pca0FullScreenConfiguration.reloadConfirmed', vcvReloadEventData );
            } else {
                eventBus.publish( 'Pca0FullScreenConfiguration.syncAppliedSVRConfirmed' );
            }
        }
    }
    ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Call initialization method to process "computeNextIncompleteFamily" SOA response
 * @param {Object} soaResponse the SOA response for "computeNextIncompleteFamily" VCV2 call
 * @returns {Object} incomplete families information
 */
export let initIncompleteFamiliesInfo = function( soaResponse, scopeSelection ) {
    return Pca0IncompleteFamiliesService.initIncompleteFamiliesInfo( soaResponse, scopeSelection );
};

/**
 * Switch to Grid view
 * @param {Boolean} reset - option to reset
 * @param {Object} commandContext containing the fscState atomic data
 */
export let showGridView = function( reset, commandContext ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    if( !commandContext || !commandContext.fscState || !commandContext.fscState.getAtomicData && !commandContext.fscState.value ) {
        return;
    }
    let fscState = commandContext.fscState;
    //since it may come either from fsc directly or via command, take care of both cases
    var newFscState = fscState.value ? { ...fscState.value } : { ...fscState.getAtomicData() };

    // Do not proceed if Grid mode is active already
    if( newFscState && newFscState.treeDisplayMode ) {
        return;
    }

    let configContext = appCtxSvc.getCtx( 'configuratorContext' );

    if( !configContext ) {
        configContext = {
            vcvVariabilityDisplayModeInGrid: Pca0Constants.GRID_DISPLAY_MODE.CURRENT
        };
        appCtxSvc.registerCtx( 'configuratorContext', configContext );
    }

    if( reset ) {
        newFscState.variantRuleDirty = false;
        delete fscContext.payloadStrings;
        delete fscContext.selectedExpressions;
    }

    if( newFscState.variantRuleDirty ) {
        // Show confirmation dialog
        eventBus.publish( 'Pca0FullScreenConfiguration.confirmSwitchingToTreeMode', {} );
    } else {
        // No user edits, switch to tree mode
        newFscState.treeDisplayMode = true;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    }
    fscState.update ? fscState.update( newFscState ) : fscState.setAtomicData( newFscState );
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Reset AtomicData to initial values, reload VCV with initial Variant Rule (if any)
 * @param {Object} fscState fscState atomic data
 * @param {Object} scopeSelection - The scopeSelection atomic data
 * @param {Object} variantRuleData - The variantRuleData atomic data
 * @param {Object} vcvReloadingEventData - the vcvReload event Info container
 */
export let resetContextAndAtomicData = ( fscState, scopeSelection, variantRuleData, vcvReloadingEventData ) => {
    // Update Context
    _.set( appCtxSvc, 'ctx.fscContext.appliedSettings', undefined ); // this will enfore fetching of perspective and other settings
    _.set( appCtxSvc, 'ctx.fscContext.currentScope', undefined ); // this will enforce selection of first scope
    _.set( appCtxSvc, 'ctx.fscContext.selectedModelObjects', vcvReloadingEventData.selectedModelObjects ); // this is needed to process selectedContext for SOA calls
    _.set( appCtxSvc, 'ctx.fscContext.currentAppliedVRs', vcvReloadingEventData.currentAppliedVRs ); // this is needed to load the right Configuration

    var newFscState = { ...fscState.getAtomicData() };
    var newScopeSelection = { ...scopeSelection.getAtomicData() };
    var newVariantRuleData = { ...variantRuleData.getAtomicData() };

    // Reset fscState:
    newFscState = {
        completenessStatus: '',
        isCompletenessStatusChipEnabled: true,
        violationSeverity: '',
        isSwitchingFromGridToListView: false,
        variantRuleDirty: false,
        guidedMode: true,
        isManualConfiguration: false,
        isHorizontalLayout: true,
        treeDisplayMode: false,
        isGridDirty: false,
        isManualModeSupported: true,
        isPlatformGreaterThan11503: true,
        isValidationInProgress: false,
        savedVariant: false,
        unloadedVariant: false
    };

    // Reset scope selection
    newScopeSelection = {
        currentScopeSelectionUid: ''
    };

    // Reset variantRuleData
    newVariantRuleData = {
        initialVariantRule: {},
        variantRulesToLoad: [],
        configPerspective: {},
        defaultConfigPerspective: {},
        useDefaultConfigPerspective: true
    };

    // Dispatch updates
    fscState.setAtomicData( newFscState );
    scopeSelection.setAtomicData( newScopeSelection );
    variantRuleData.setAtomicData( newVariantRuleData );
};

export default exports = {
    initSaveOrSaveAsPanel,
    toggleShowSummaryPanel,
    getSelectionForVariantContext,
    getActiveVariantRules,
    getProfileSettingsForFsc,
    initSettings,
    handleFSCConfiguration,
    fscActivateCommandPanel,
    fscActivateSaveAsCommandPanel,
    initFSCConfiguration,
    destroyFSCConfiguration,
    synchronizeAppliedVRs,
    processVariantInfoChange,
    wipConfirmHandleSVRChange,
    isVCVOpenedFromConfigurator,
    initIncompleteFamiliesInfo,
    getSaveHandler,
    saveVariantExpressions,
    showGridView,
    getConfigPerspective,
    convertSelectedExpressionJsonObjectToString,
    resetContextAndAtomicData
};
