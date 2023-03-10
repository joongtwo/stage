// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/configuratorUtils
 */
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import commonUtils from 'js/pca0CommonUtils';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/Pca0ExpressionGridService';
import featureService from 'js/pca0FeaturesService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import Pca0Constants from 'js/Pca0Constants';
import pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import tcSesnD from 'js/TcSessionData';
import tcSvrVer from 'js/TcServerVersion';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

var exports = {};

/**
 * Show notification message with message type.
 * @param {String} message input message text
 * @param {String} messageType input message type
 */
export let showNotificationMessage = function( message, messageType ) {
    if( message !== '' && message !== undefined ) {
        if( messageType === 'INFO' ) {
            messagingService.showInfo( message );
        } else if( messageType === 'ERROR' ) {
            messagingService.showError( message );
        } else if( messageType === 'WARNING' ) {
            messagingService.showWarning( message );
        }
    }
};

/**
 * Get the instance of the Locale Resource for FullScreenConfiguration
 * (FullScreenConfigurationMessages json file)
 * @return {Object} The instance of locale resource if found, null otherwise.
 */
export let getFscLocaleTextBundle = function() {
    var localeTextBundle = localeService.getLoadedText( 'FullScreenConfigurationMessages' );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
};

/**
 * Get the instance of the Locale Resource for Configurator
 * (ConfiguratorMessages json file)
 * @return {Object} : The instance of locale resource if found, null otherwise.
 */
export let getCustomConfigurationLocaleTextBundle = function() {
    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    if( localeTextBundle ) {
        return localeTextBundle;
    }
    return null;
};

/**
 * Get the active selection for Variant Context
 * @param {String} ctx context name
 * @return {Object} selected object(s) in Primary Work Area.
 */
export let getSelectionForVariantContext = function( ctx ) {
    // ace structure
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( !_.isUndefined( fscContext && fscContext.selectedModelObjects ) ) {
        return fscContext.selectedModelObjects[ fscContext.selectedModelObjects.length - 1 ];
    }
    // non ace structure
    var multiSelections = appCtxSvc.getCtx( 'mselected' );
    if( multiSelections && multiSelections.length > 1 ) {
        // return last selected object in case of multiple selections
        return multiSelections[ multiSelections.length - 1 ];
    }
    if( ctx && ctx === Pca0Constants.FSC_CONTEXT && appCtxSvc.getCtx( ctx ) && appCtxSvc.getCtx( 'selected' ) !== undefined ) {
        return appCtxSvc.getCtx( 'selected' );
    }
    return multiSelections[ 0 ];
};

/**
 * Get current Configuration mode
 * @param {String} ctx name of current context
 * @returns {String} current variant mode Guided/Manual
 */
export let getConfigurationMode = function( ctx ) {
    var variantMode = 'guided';
    var context = appCtxSvc.getCtx( ctx );
    if( context && context.guidedMode === false ) {
        variantMode = 'manual';
    }
    return variantMode;
};

/**
 *
 * Get Active Variant Rule for Full Screen Configuration
 * This API returns initialVariantRule only when selections are undefined
 * @returns {String} the currently active variant rule
 */
export let getFscActiveVariantRules = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( context.selectedExpressions === undefined && context.initialVariantRule !== undefined ) {
        return [ context.initialVariantRule ];
    }
    return null;
};

/**
 * Validate if given input context is Full Screen Configuration context
 * @param {String} ctx input context
 * @returns {String} Boolean String
 */
export let getIsFscContext = function( ctx ) {
    if( ctx !== undefined && ctx === Pca0Constants.FSC_CONTEXT ) {
        return 'true';
    }
    return 'false';
};

/**
 * Get Applied profile Settings for Full Screen Configuration
 * @param {String} ctx input context
 * @returns {String} Profile Settings information - JSON string
 */
export let getProfileSettingsForFsc = function( ctx ) {
    if( ctx !== undefined && ctx !== Pca0Constants.FSC_CONTEXT ) {
        return '';
    }
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( !fscContext.appliedSettings || !fscContext.appliedSettings.validationProfile ) {
        return '';
    }

    // ProfileDisplayName is the localized string for Custom and OOTB Overlay/Order: skip it
    var profileSettings = {};
    profileSettings.pca0ProfileName = fscContext.appliedSettings.validationProfile.pca0ProfileName;
    profileSettings.pca0ValidationSeverity = fscContext.appliedSettings.validationProfile.pca0ValidationSeverity;
    profileSettings.pca0ExpansionSeverity = fscContext.appliedSettings.validationProfile.pca0ExpansionSeverity;
    profileSettings.pca0AllowMultipleSelections = fscContext.appliedSettings.validationProfile.pca0AllowMultipleSelections;
    if( isPlatformSupportedForContentConfigurationProfileSettings() ) {
        profileSettings.pca0ApplyConstraints = fscContext.appliedSettings.validationProfile.pca0ApplyConstraints;
        profileSettings.pca0AllowValidationRulesToExpand = fscContext.appliedSettings.validationProfile.pca0AllowValidationRulesToExpand;
    }
    return JSON.stringify( profileSettings );
};

/**
 * Get Selected Expressions using active selection map
 * @param {Object} data - VM Object
 * @returns {Object} Selected Expressions in PCA Grid format
 */
export let getActiveSelectedExpressions = function( data ) {
    return exprGridSvc.getPCAGridFromSelectionMap( data.soaResponse.businessObjectToSelectionMap );
};

/**
 * Validate if eventMap contains flag to attach VR to content
 * @param {Object} data - VM Object
 * @returns {String} Boolean String
 */
export let getAttachVariantRuleToContent = function( data ) {
    var expr = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0SaveVariantRule.setExpression' );
    var ret = 'false';
    if( expr && expr.attachVariantRuleToContent ) {
        ret = 'true';
    }
    return ret;
};

/**
 * Perform localization on input profile
 * I.E. add new property 'pca0ProfileName' to validationProfile.
 * New peoperty is localized if profileName is OOTB Overlay/Order or Custom
 * @param {Object} validationProfile validation profile (solver profile)
 */
export let localizeValidationProfileNames = function( validationProfile ) {
    if( validationProfile.pca0ProfileName === 'pca0Order' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Order;
    } else if( validationProfile.pca0ProfileName === 'pca0OrderWithApplyConstraints' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0OrderWithApplyConstraints;
    } else if( validationProfile.pca0ProfileName === 'pca0Overlay' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Overlay;
    } else if( validationProfile.pca0ProfileName === 'pca0Custom' ) {
        validationProfile.profileDisplayName = exports.getFscLocaleTextBundle().pca0Custom;
    } else {
        validationProfile.profileDisplayName = validationProfile.pca0ProfileName;
    }
};

/**
 * Get instance of created Variant Rule from SOA response
 * @param {Object} response the SOA response
 * @returns {Object} created Variant Rule.
 */
export let getCreatedVariantRule = function( response ) {
    if( response.ServiceData.created ) {
        var variantRuleUID = response.ServiceData.created[ 0 ];
        return response.ServiceData.modelObjects[ variantRuleUID ];
    }
};

/**
 * Get Input required for createRelateAndSubmitObjects SOA
 * @param {Object} data the view model data object
 * @param {String} type the createVariantPreference value
 * @return {String} Create Input - String format.
 */
export let getConfigCreateInput = function( data, type, editHandler ) {
    return addObjectUtils.getCreateInput( data, null, { props: { type_name: { dbValues: [ type ] } } }, editHandler );
};

/**
 * This method Control the Visibility of save btn on configuration panel
 * @param {Object} eventData context name
 * @param {Object} fscState atomic data
 *
 */
export let handleSaveSVRCommandVisibility = function( eventData, fscState ) {
    //set the dirty state on fscState atomic data - this replaces the former fscontext.variantRulePanelDirty
    if( eventData.selectedCtx === 'fscContext' && fscState !== undefined && fscState.getAtomicData() !== undefined ) {
        let newFscState = { ...fscState.getAtomicData() };
        let isDirty = newFscState.variantRuleDirty;
        newFscState.variantRuleDirty = eventData.variantRulePanelDirty;
        if( isDirty !== eventData.variantRulePanelDirty ) {
            fscState.setAtomicData( newFscState );
        }
    }
};

/**
 * GetView Model Object for input created Variant Rule
 * @param {Object} response SOA response
 * @returns {Object} VMO for created Variant Rule.
 */
export let getVariantRuleVMO = function( response ) {
    if( !_.isUndefined( response.ServiceData.created ) ) {
        return viewModelObjectService.createViewModelObject( response.ServiceData.created[ 0 ] );
    }
};

/**
 * Initialize variant rule and reset the  dirty state of Variant Rule Panel.
 * @param {Object} event data
 * @param {Object} fscState atomic data
 * @param {Object} variantRuleData atomic data
 */
export let resetDirtyFlag = function( eventData, fscState, variantRuleData ) {
    var varContext = appCtxSvc.getCtx( eventData.variantContext );
    varContext.initialVariantRule = eventData.variantRuleVMO;

    if( variantRuleData !== undefined && variantRuleData.getAtomicData() !== undefined ) {
        var newVariantRuleData = { ...variantRuleData.getAtomicData() };
        newVariantRuleData.variantRulesToLoad = [ eventData.variantRuleVMO ];
        variantRuleData.setAtomicData( newVariantRuleData );
    }
    if( fscState !== undefined && fscState.getAtomicData() !== undefined ) {
        var newFscState = { ...fscState.getAtomicData() };
        newFscState.variantRuleDirty = false;
        newFscState.savedVariant = true;
        fscState.setAtomicData( newFscState );
    }
};

/**
 * Get current group/scope from input context
 * @param {String} ctx input context key
 * @returns {String} the currentGroup
 */
export let getCurrentGroup = function( ctx ) {
    var context = appCtxSvc.getCtx( ctx );
    if( ctx && ctx === Pca0Constants.FSC_CONTEXT ) {
        return context.currentScope;
    }
    return context.currentGroup;
};

/**
 * Get Payload String from FSC context
 * @returns {Object} PayloadStrings for FSC context
 */
export let getPayloadStrings = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    return context.payloadStrings;
};

/**
 * Get Selected Expression from FSC context
 * @returns {ObjectConstructor} the selectedExpressions
 */
export let getSelectedExpressions = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    return context.selectedExpressions;
};

/**
 * Handle Invalid Configuration for possible scenarios:
 * 1. Switching to Guided Mode from Manual Mode with imprecise configuration
 * 2. Selecting an option value when there are invalid rules defined
 * @param {String} cntx context Key
 */
export let handleInvalidConfiguration = function( cntx ) {
    var context = appCtxSvc.getCtx( cntx );
    if( context.switchingToGuidedMode ) {
        eventBus.publish( 'awCustomVariantPanel.showValidationErrorMessage', {
            switchingToGuidedMode: 'true'
        } );
    } else {
        let configExprMap = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );
        if( configExprMap && !_.isEmpty( configExprMap ) && context.family && context.value ) {
            // Remove the last selection from user selection list and retain existing option groups
            var optionValueSelections = configExprMap[ context.family.familyStr ];
            if( optionValueSelections !== undefined ) {
                var indexToRemove = null;
                for( var j = 0; j < optionValueSelections.length; j++ ) {
                    if( optionValueSelections[ j ].nodeID === context.value.optValueStr ) {
                        indexToRemove = j;
                        break;
                    }
                }
                if( indexToRemove !== null && indexToRemove > -1 ) {
                    optionValueSelections.splice( indexToRemove, 1 );
                }
            }
        }

        // Fire event to show error message
        if( context.family !== undefined && context.value !== undefined ) {
            context.validationErrorFamily = context.family.familyDisplayName;
            context.validationErrorValue = context.value.valueDisplayName;
            appCtxSvc.updateCtx( cntx, context );
            eventBus.publish( 'awCustomVariantPanel.showValidationErrorMessage', {
                switchingToGuidedMode: 'false'
            } );
        }
    }
};

/**
 * Build the violation string.
 *
 * @param {String} featureId - UID of a feature
 * @param {ObjectArray} labels - Labels to be shown on feature objects like violations etc.
 * @returns {Object} Violation Info container for the given feature/value
 */
export let buildViolationString = function( featureId, labels ) {
    var violationInfo = {};
    var violationMessage = '';
    var violationIds = [];

    if( labels !== undefined ) {
        var nodeMap = labels.violationMap[ 0 ].nodeMap;
        if( nodeMap !== undefined ) {
            for( const key in nodeMap ) {
                if( nodeMap.hasOwnProperty( key ) ) {
                    let [ familyUid ] = key.split( ':' ); //parse the nodeMap key
                    let tmpUid = familyUid + ':' + featureId;
                    var violationObj = nodeMap[ tmpUid ];
                    if( violationObj !== undefined ) {
                        violationIds = violationObj[ 0 ].props.violationIDs;
                    }
                }
            }
        }
    }

    if( labels && violationIds.length > 0 ) {
        for( var i = 0; i < violationIds.length; i++ ) {
            var violationId = violationIds[ i ];
            var violationObj = labels.violations[ 0 ].nodeMap[ violationId ];
            violationMessage = violationMessage + ( i + 1 ) + '. ' + violationObj[ 0 ].displayName + '\n';

            if( i === 0 ) {
                // Server will always contain first violation id with highest severity.
                // We can rely on it to decide the icon to be shown for violation.
                violationInfo.violationSeverity = violationObj[ 0 ].props.serverity[ 0 ];
            }
        }
        if( violationMessage.length > 0 ) {
            violationInfo.violationMessage = violationMessage.slice( 0, -1 );
        }
    }
    return violationInfo;
};

/**
 * Get Summary of violations.
 * @param {Object} labels - Labels to be shown on feature objects like violations etc.
 * @param {String} group - Currently active option group in variant panel
 * @returns {Object} Violation Info container for the given group
 */
export let parseResponseAndExtractViolations = function( labels, group ) {
    if( labels !== undefined && labels.violationMap[ 0 ] !== undefined &&
        labels.violationMap[ 0 ].nodeMap !== undefined ) {
        // Get the violation ids from the labels map and extract the keys.
        var violationIds = Object.keys( labels.violationMap[ 0 ].nodeMap );
        let summaryViolationsInfo = [];
        if( group !== undefined && violationIds !== undefined && violationIds.length > 0 ) {
            for( var inx = 0; inx < group.families.length; inx++ ) {
                let violationIds2 = violationIds.map( id => {
                    //free form date comes in the form: CkW5GycSpgwwkB:CkW5GycSpgwwkB:2022-04-19T00:00:00Z"
                    //so you have to just ignore the first part in general
                    return id.slice( id.indexOf( ':' ) + 1 );
                } );
                if( group.families[ inx ].values.length > 0 ) {
                    for( var valueIdx = 0; valueIdx < group.families[ inx ].values.length; valueIdx++ ) {
                        var valueObj = group.families[ inx ].values[ valueIdx ];
                        // Process this value if its ID exist in the violationIds.
                        if( violationIds2.includes( valueObj.optValueStr ) ) {
                            var violationsInfo = this.buildViolationString( valueObj.optValueStr, labels );
                            if( violationsInfo !== null && violationsInfo.violationMessage !== undefined ) {
                                // Update the violations directly onto the value object which is present in the UI model.
                                valueObj.violationsInfo = violationsInfo;
                                valueObj.hasViolation = true;
                            } else {
                                valueObj.hasViolation = false;
                            }
                            summaryViolationsInfo.push( violationsInfo );
                        }
                    }
                }
            }
        }
        return summaryViolationsInfo;
    }
};

/**
 * Verify current TC platform is supported for FSC operations: 11.4
 * @returns {Boolean} True if current platform version is 11.4 or later
 */
export let isPlatformVersionSupported = function() {
    var majorVersion = tcSesnD.getTCMajorVersion();
    var minorVersion = tcSesnD.getTCMinorVersion();
    var qrmNumber = tcSesnD.getTCQRMNumber();

    // If major version is greater than 11 .e.g TC12x onwards, then set true
    if( majorVersion > 11 ) {
        return true;
    }

    // Major version is 11
    // 11.4 version's internal name is 11.2.5
    // If we find an API which returns display version instead of internal version, then we'll have to fix this
    return majorVersion === 11 && minorVersion >= 2 && qrmNumber >= 5;
};

/**
 * Validate if TC platform is greater than 11.6
 * @returns {Boolean} true if TC platform is greater than 116
 */
export let isPlatformVersion116AndGreater = function() {
    var majorVersion = tcSesnD.getTCMajorVersion();
    var minorVersion = tcSesnD.getTCMinorVersion();
    var qrmNumber = tcSesnD.getTCQRMNumber();
    // If major version is greater than 11 .e.g TC12x onwards, then set true
    if( majorVersion > 12 ) {
        return true;
    } else if( majorVersion === 12 ) {
        return minorVersion >= 1;
    } else if( majorVersion === 11 ) {
        // Major version is 11
        // 11.4 version's internal name is 11.2.7
        // If we find an API which returns display version instead of internal version, then we'll have to fix this
        return majorVersion === 11 && minorVersion >= 2 && qrmNumber >= 7;
    }
    return false;
};

/**
 * Validate if TC platform is greater than 11.5.0.3
 * @returns {Boolean} true if TC platform is greater than 11503
 */
export let isPlatformGreaterThan11503 = function() {
    var majorVersion = tcSesnD.getTCMajorVersion();
    var minorVersion = tcSesnD.getTCMinorVersion();
    var qrmNumber = tcSesnD.getTCQRMNumber();

    // If major version is greater than 11 .e.g TC12x onwards, then set true
    if( majorVersion > 12 ) {
        return true;
    } else if( majorVersion === 12 ) {
        return minorVersion >= 1;
    } else if( majorVersion === 11 ) {
        // Major version is 11
        // 11.5 version's internal name is 11.2.6
        // If we find an API which returns display version instead of internal version, then we'll have to fix this
        if( majorVersion === 11 && minorVersion === 2 ) {
            if( qrmNumber === 6 ) {
                // In case of base version TC 11.5.0 server version string is like Server Version: V.11.2.6.60_20180616.00
                // while in case of patch release TC 11.5.0.3 server version string is like Server Version: V.11.2.6.62_20190330.00
                // and for every subsequent patch release _62 counter is increased by 1 for example TC 11.5.0.10 is V.11.2.6.69_20190415.00.
                // So we have below code to split based on "_" and then get the first splited string and then use that
                // string to identify the patch version.
                var phase = tcSvrVer.phase;
                if( phase ) {
                    var stringArray = phase.split( '_' );
                    if( stringArray !== null && stringArray.length >= 2 && stringArray[ 0 ] !== null ) {
                        var str = stringArray[ 0 ];
                        var phaseVersion = parseInt( str, 10 );
                        if( phaseVersion >= 62 ) {
                            return true;
                        }
                    }
                }
            }
            if( qrmNumber > 6 ) {
                return true;
            }
        }
        return majorVersion === 11 && minorVersion > 2;
    }
    return false;
};

/**
 * TODO REMOVE and use isPlatformVersionAtleast
 * Verify if platform version meets requirement: 12.4
 * @returns {Boolean} true if platform version meets requirement
 */
export let isPlatformVersionAtleast124 = function() {
    var majorVersion = tcSesnD.getTCMajorVersion();
    var minorVersion = tcSesnD.getTCMinorVersion();

    // Major version is 12
    // 12.4 version's internal name is 12.4.0
    return majorVersion === 12 && minorVersion >= 4 || majorVersion >= 13;
};

/**
 * Verify if platform version meets requirement
 * @param {Int} majorVersion TC Major Version
 * @param {Int} minorVersion TC Minor Version
 * @returns {Boolean} true if platform version meets requirement
 */
export let isPlatformVersionAtleast = function( majorVersion, minorVersion ) {
    var tcMajorVersion = tcSesnD.getTCMajorVersion();
    var tcMinorVersion = tcSesnD.getTCMinorVersion();
    return tcMajorVersion > majorVersion || tcMajorVersion === majorVersion && tcMinorVersion >= minorVersion;
};

/**
 * Verify current TC platform is supported for FSC Solver profile operations: 12.4.0.1 or 13.1
 * @returns {Boolean} true if platform version meets requirement
 */
export let isPlatformSupportedForContentConfigurationProfileSettings = function() {
    var majorVersion = tcSesnD.getTCMajorVersion();
    var minorVersion = tcSesnD.getTCMinorVersion();
    var qrmNumber = tcSesnD.getTCQRMNumber();

    if( majorVersion === 12 && minorVersion === 4 ) {
        return qrmNumber >= 1;
    } else if( majorVersion === 12 && minorVersion > 4 || majorVersion === 13 && minorVersion >= 1 || majorVersion > 13 ) {
        return true;
    }
    return false;
};

/**
 * Display the error message when switching to guided mode from manual is not allowed.
 * @param {Object} data the view model data object
 * */
export let showUnableToSwitchToGuidedModeMessage = function( data ) {
    messagingService.reportNotyMessage( data, data._internal.messages, 'validationErrorOnSwitchingToGuidedMode' );
};

/**
 * Display validation error message and clean up validation error labels from family/value
 * @param {Object} data the view model data object
 * @param {String} cntx context Key
 */
export let showValidationErrorMessage = function( data, cntx ) {
    messagingService.reportNotyMessage( data, data._internal.messages, 'validationErrorOnSelection' );

    // Remove error family and value from context
    var context = appCtxSvc.getCtx( cntx );
    delete context.validationErrorFamily;
    delete context.validationErrorValue;
};

/**
 * Get System Selection States
 * @returns {Array} list of System selection states
 */
export let getSystemSelectionStates = function() {
    return [ 5, 6, 9, 10 ];
};

/**
 * Initialize local Cache and Effectivity data structure
 * It is used to collaborate on settings changes across multiple subpanels/directives
 * @function initializeCache
 * @param {String} ctxName - Context name
 */
export let initializeCache = function( ctxName ) {
    var context = appCtxSvc.getCtx( ctxName );
    context.settingsCache = {
        effectivityInfo: {
            currentStartEffDates: { dbValues: [ '' ] },
            currentEndEffDates: { dbValues: [ '' ] },
            currentStartEffUnits: { dbValues: [ '-1' ] },
            currentEndEffUnits: { dbValues: [ '-1' ] }
        },
        filterCriteriaModified: false,
        profileSettingsDirty: false
    };

    if( ctxName === Pca0Constants.FSC_CONTEXT ) {
        context.settingsCache.profileSettings = {};
    }
    appCtxSvc.updatePartialCtx( ctxName + '.settingsCache', context.settingsCache );
};

/**
 * Initialize Config Perspective and Filter Criteria on VCA context
 * @param {Object} configPerspective - Configurator Perspective
 * @param {String} contextKey - Context Key
 */
export let initializeFilterCriteriaForContext = function( configPerspective, contextKey ) {
    var configContext = appCtxSvc.getCtx( contextKey );
    if( configContext ) {
        // Perspective Obj is needed when setting properties on data model service
        configContext.configPerspective = configPerspective;

        // Note: this is redundant (all data is in perspective already)
        // Keeping it for now to be aligned with Settings panel in VCV
        configContext.appliedSettings = {
            configSettings: {
                props: {
                    pca0RevisionRule: configPerspective.props.cfg0RevisionRule,
                    pca0RuleDate: configPerspective.props.cfg0RuleSetCompileDate,
                    pca0Effectivity: configPerspective.props.cfg0RuleSetEffectivity
                }
            }
        };

        // Clear cache
        exports.initializeCache( contextKey );

        // Initialize effectivity
        pca0FilterCriteriaSettingsService.initializeEffectivity( contextKey );

        appCtxSvc.updateCtx( contextKey, configContext );

        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' );

        // Fire special event for Revision Rule: this will initialize internal VM data
        // Removing from RevisionRule VM any dependency to context
        var appliedRevisionRule = configPerspective.props.cfg0RevisionRule;
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', appliedRevisionRule );
    }
};

/**
 * Get the map of nodeUID to Node Object from the SOA response
 * @param {Object} response - SOA response
 * @returns {Object} Map containing nodeUID as key and Node as value
 */
let getTreeDataMap = function( response ) {
    let variabilityTreeDataMap = {};
    let variantTreeData = response.variabilityTreeData;
    let treeDataLength = variantTreeData.length;
    for( let ix = 0; ix < treeDataLength; ix++ ) {
        let treeNode = variantTreeData[ ix ];
        variabilityTreeDataMap[ treeNode.nodeUid ] = treeNode;
    }
    return variabilityTreeDataMap;
};

/**
 * Create group node structure to display in FSC view
 * @param {Object} response - vcv2 response
 * @param {Boolean} isPackageContext true if this is operating in the context of package
 * @returns {ObjectArray} group nodes
 */
export let populateScopes = function( response, isPackageContext ) {
    let treeNodes = [];
    let variantTreeData = response.variabilityTreeData;
    let variabilityTreeDataMap = getTreeDataMap( response );
    let vmos = response.viewModelObjectMap;
    let labels = response.labels;
    if( !_.isEmpty( variantTreeData ) ) {
        let parentNode = variabilityTreeDataMap[ '' ];
        let wsObjects = undefined;
        if( response.ServiceData && response.ServiceData.modelObjects ) {
            wsObjects = response.ServiceData.modelObjects;
        }
        if( parentNode && parentNode.childrenUids ) {
            _.forEach( parentNode.childrenUids, id => {
                treeNodes.push( featureService.createGroupsNode( variabilityTreeDataMap, vmos, id, wsObjects, labels ) );
            } );
        }
    }
    //do not update the groups for a response in the package context - it only contains the package and it's meant for the flyout only
    if( !isPackageContext ) {
        var updatedGroups = treeNodes.map( ( { families, ...rest } ) => rest );
        eventBus.publish( 'Pca0Scopes.updateGroups', { updatedGroupsList: updatedGroups } );
    }
    return treeNodes;
};

/**
 * Return the rule date translation mode
 * @returns {String} rule date translation mode i.e. latest, Default, null, date
 */
export let getRuleDateTranslationMode = function() {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let appliedSettings = fscContext.appliedSettings;
    let ruleDateTranslationMode;
    if( appliedSettings && appliedSettings.ruleDateTranslationMode ) {
        ruleDateTranslationMode = appliedSettings.ruleDateTranslationMode;
    }
    return ruleDateTranslationMode;
};

/**
 * Initialize RevisionRule VM Property for FullScreenConfiguration
 * @return {Object} currentRevisionRule VM property
 */
export let initCurrentRevisionRuleFromSettingsForFSC = function() {
    let contextKey = Pca0Constants.FSC_CONTEXT;
    var fscContext = appCtxSvc.getCtx( contextKey );
    var revisionRule = fscContext.appliedSettings.configSettings.props.pca0RevisionRule;
    var currentRevisionRule = uwPropertyService.createViewModelProperty( revisionRule.dbValues[ 0 ], revisionRule.uiValues[ 0 ], 'STRING', revisionRule.dbValues[ 0 ], revisionRule.uiValues );
    currentRevisionRule.isEditable = true;
    return currentRevisionRule;
};

/**
 * Convert the selected expression json string array to single selected Expression object
 * for ex. [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]

 * will be converted to
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * @param {Object} selectedExpressionsJsonArray - selected expression json string array
 * @returns {Object} single selected expression
 */
export let convertSelectedExpressionJsonStringToObject = function( selectedExpressionsJsonArray ) {
    if( _.isEmpty( selectedExpressionsJsonArray ) ) {
        return {};
    }
    let selectedExpressions = {};
    _.forEach( selectedExpressionsJsonArray, ( selectedExpressionsJson ) => {
        let selectedExpression = JSON.parse( selectedExpressionsJson );
        let objectUid = _.keys( selectedExpression )[ 0 ];

        if( _.isEmpty( selectedExpression[ objectUid ] ) ) {
            selectedExpression[ objectUid ].push( {} );
        }
        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'formula' ) ) {
            selectedExpression[ objectUid ][ 0 ].formula = '';
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'expressionType' ) ) {
            selectedExpression[ objectUid ][ 0 ].expressionType = -1;
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'exprID' ) ) {
            selectedExpression[ objectUid ][ 0 ].exprID = '';
        }

        if( !selectedExpression[ objectUid ][ 0 ].hasOwnProperty( 'configExpressionSet' ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet = [];
        }
        if( _.isEmpty( selectedExpression[ objectUid ][ 0 ].configExpressionSet ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet.push( { configExpressionSections: [] } );
        }
        if( _.isEmpty( selectedExpression[ objectUid ][ 0 ].configExpressionSet[ 0 ] ) ) {
            selectedExpression[ objectUid ][ 0 ].configExpressionSet[ 0 ].configExpressionSections = [];
        }

        _.assign( selectedExpressions, selectedExpression );
    } );

    return selectedExpressions;
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
    if( _.isEmpty( selectedExpressions ) || _.isNull( selectedExpressions ) ) {
        return null;
    }
    let selectedExpressionJsonArray = [];
    _.forOwn( selectedExpressions, ( selectedExpression, objectUid ) => {
        selectedExpressionJsonArray.push( JSON.stringify( {
            [ objectUid ]: selectedExpression
        } ) );
    } );

    return selectedExpressionJsonArray;
};

export let getJsonStringActiveSelectedExpressions = function( data ) {
    return convertSelectedExpressionJsonObjectToString( exprGridSvc.getPCAGridFromSelectionMap( data.soaResponse.businessObjectToSelectionMap ) );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */

export let getFscConfigPerspective = function( variantRuleData ) {
    var variantRuleDataValue;
    if( variantRuleData.getAtomicData ) {
        variantRuleDataValue = variantRuleData.getAtomicData();
    } else {
        variantRuleDataValue = variantRuleData.value;
    }

    if( variantRuleDataValue.useDefaultConfigPerspective ) {
        var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
        //if we switch to using the default perspective if there are no applied settings, make sure to re-apply them
        if( fscContext && !fscContext.appliedSettings ) {
            fscContext.appliedSettings = fscContext.defaultAppliedSettings;
            appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
        }
        return variantRuleDataValue.defaultConfigPerspective;
    }
    return variantRuleDataValue.configPerspective;
};

export default exports = {
    showNotificationMessage,
    getFscLocaleTextBundle,
    getCustomConfigurationLocaleTextBundle,
    getSelectionForVariantContext,
    getConfigurationMode,
    getFscActiveVariantRules,
    getIsFscContext,
    getProfileSettingsForFsc,
    getActiveSelectedExpressions,
    getAttachVariantRuleToContent,
    localizeValidationProfileNames,
    getCreatedVariantRule,
    getConfigCreateInput,
    handleSaveSVRCommandVisibility,
    getVariantRuleVMO,
    resetDirtyFlag,
    getCurrentGroup,
    getPayloadStrings,
    getSelectedExpressions,
    handleInvalidConfiguration,
    buildViolationString,
    parseResponseAndExtractViolations,
    isPlatformVersionSupported,
    isPlatformVersion116AndGreater,
    isPlatformGreaterThan11503,
    isPlatformVersionAtleast124,
    isPlatformVersionAtleast,
    isPlatformSupportedForContentConfigurationProfileSettings,
    showUnableToSwitchToGuidedModeMessage,
    showValidationErrorMessage,
    getSystemSelectionStates,
    initializeCache,
    initializeFilterCriteriaForContext,
    populateScopes,
    getRuleDateTranslationMode,
    initCurrentRevisionRuleFromSettingsForFSC,
    convertSelectedExpressionJsonStringToObject,
    convertSelectedExpressionJsonObjectToString,
    getJsonStringActiveSelectedExpressions,
    getFscConfigPerspective

};
