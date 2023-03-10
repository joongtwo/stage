// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0RuleDateConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import AwFilterService from 'js/awFilterService';
import AwPromiseService from 'js/awPromiseService';
import commandPanelService from 'js/commandPanel.service';
import configuratorUtils from 'js/configuratorUtils';
import dateTimeService from 'js/dateTimeService';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import policySvc from 'soa/kernel/propertyPolicyService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

var getViewModelProperty = function( dbValue, type ) {
    let viewModelProperty = uwPropertyService.createViewModelProperty( dbValue, dbValue, type, dbValue, [ dbValue ] );
    viewModelProperty.isEditable = true;
    return viewModelProperty;
};

/**
 * Initialize Rule Date
 * Based on values from settings or settingsMO, populate settingsCache
 * @param {String} contextKey : Name of relevant context.
 */
export let initializeRuleDate = function( contextKey ) {
    var context = appCtxSvc.getCtx( contextKey );
    var appliedSettings = context.appliedSettings;
    var settingsCache = { ...context.settingsCache };
    if( contextKey === 'fscContext' ) {
        // Update cached value
        if( appliedSettings.ruleDateTranslationMode ) {
            settingsCache.ruleDateTranslationMode = appliedSettings.ruleDateTranslationMode;
        }
    }
    if( settingsCache.ruleDateTranslationMode ) {
        // Update context
        appCtxSvc.updatePartialCtx( contextKey + '.settingsCache', settingsCache );
    }
};

/**
 * Initialize the RuleDate Configuration Section
 * Select value as from appliedSettings
 * Update Settings cache for selected RuleDate
 * Rule date coming from context can be "No Rule Date" or any date
 * @param {Object} subPanelContext - subPanelContext
 * @return {Object} Rule Date Info container
 */
export let initializeRuleDateConfigurationData = function( subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isRuleDateFeatureReadOnly = {};
    isRuleDateFeatureReadOnly.dbValue = subPanelContext.isConfigurationReadOnly.dbValue;

    var context = appCtxSvc.getCtx( subPanelContext.contextKey );
    var settingsCache = context.settingsCache;

    if( subPanelContext.contextKey !== 'fscContext' && ( !context || _.isUndefined( context.appliedSettings ) ) ) {
        return;
    }

    // Get VM property for current rule date
    var ruleDate = context.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ];
    var currentRuleDate;

    // non-VCV: null or Date is provided
    // VCV: epoch (UTC seconds) are provided or internal key :null" for no rule date
    if( contextKey !== 'fscContext' ) {
        if( ruleDate === null && context.appliedSettings.configSettings.props.pca0RuleDate.isNulls[ 0 ] ) {
            // No Rule Date
            var noRuleDateStr = configuratorUtils.getFscLocaleTextBundle().noRuleDate;
            currentRuleDate = getViewModelProperty( noRuleDateStr, 'STRING' );
            settingsCache.selectedRuleDate = 'null';
        } else {
            var ruleDateUtcMilliSeconds = Date.parse( ruleDate ); // milliseconds are returned
            var utcSeconds = Math.floor( ruleDateUtcMilliSeconds / 1000 );
            var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
            dateTimeValue.setUTCSeconds( utcSeconds );
            currentRuleDate = getViewModelProperty( dateTimeValue, 'DATE' );
            currentRuleDate.uiValue =
                AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );
            settingsCache.selectedRuleDate = utcSeconds;
        }

        // Initialize View Model Object for Current Rule Date and cache
        appCtxSvc.updatePartialCtx( contextKey + '.settingsCache', settingsCache );
    } else {
        // Re-init VM Property after RuleDate change
        if( settingsCache.selectedRuleDate && settingsCache.selectedRuleDate !== ruleDate ) {
            currentRuleDate = exports.updateLocalData( subPanelContext );
        } else {
            // Initialize Rule Date VM property
            if( ruleDate === 'null' ) {
                var noRuleDateStr = configuratorUtils.getFscLocaleTextBundle().noRuleDate;
                currentRuleDate = getViewModelProperty( noRuleDateStr, 'STRING' );

                // Initialize View Model Object for Current Rule Date and cache
                settingsCache.selectedRuleDate = 'null';
                appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
            } else if( settingsCache.ruleDateTranslationMode ) {
                var ruleDateTranslationMode = settingsCache.ruleDateTranslationMode;
                var selectedRuleDate;
                if( ruleDateTranslationMode === 'System Default' ) {
                    noRuleDateStr = configuratorUtils.getFscLocaleTextBundle().systemDefault;
                    currentRuleDate = getViewModelProperty( noRuleDateStr, 'STRING' );

                    selectedRuleDate = 'Default';
                } else if( ruleDateTranslationMode === 'Latest' ) {
                    noRuleDateStr = configuratorUtils.getFscLocaleTextBundle().latest;
                    currentRuleDate = getViewModelProperty( noRuleDateStr, 'STRING' );

                    selectedRuleDate = 'latest';
                } else if( ruleDateTranslationMode === 'DateOnSVR' ) {
                    // Set the initial date to the epoch and add UTC units
                    var utcSeconds = Number( ruleDate );
                    var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
                    dateTimeValue.setUTCSeconds( utcSeconds );
                    currentRuleDate = getViewModelProperty( dateTimeValue, 'DATE' );
                    currentRuleDate.uiValue =
                        AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );
                    selectedRuleDate = ruleDate;
                }
                // Initialize View Model Object for Current Rule Date and cache
                settingsCache.selectedRuleDate = selectedRuleDate;
                appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
            } else {
                // Set the initial date to the epoch and add UTC units
                var utcSeconds = Number( ruleDate );
                var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
                dateTimeValue.setUTCSeconds( utcSeconds );

                currentRuleDate = getViewModelProperty( dateTimeValue, 'DATE' );
                currentRuleDate.uiValue =
                    AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );

                // Initialize cached value
                settingsCache.selectedRuleDate = ruleDate;
                appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
            }
        }
    }

    return { contextKey, isRuleDateFeatureReadOnly, currentRuleDate };
};

/**
 * Navigate to RuleDate Sub View
 * @param {Object} data - The ViewModel object of the Rule Date view
 */
export let navigateToRuleDateSub = function( data ) {
    var panelContext = {
        destPanelId: data.contextKey !== 'fscContext' ? 'Pca0RuleDatePanel' : 'Pca0RuleDateSub',
        title: configuratorUtils.getFscLocaleTextBundle().ruleDateSubPanelTitle,
        contextKey: data.contextKey,
        recreatePanel: true,
        supportGoBack: data.contextKey === 'fscContext'
    };

    if( data.contextKey !== 'fscContext' ) {
        commandPanelService.activateCommandPanel( 'Pca0RuleDatePanel', 'aw_toolsAndInfo', panelContext );
    } else {
        eventBus.publish( 'awPanel.navigate', panelContext );
    }
};

/**
 * Initialize data for the subView in use in VCA/VCV context.
 * @param {Object} data - The ViewModel object of the Rule Date subView
 * @return {Object} Rule Date Info container for sub view
 */
export let initializeSubViewData = function( data ) {
    let clonedData = { ...data };
    var panelContext = appCtxSvc.getCtx( 'panelContext' );
    let contextKey = panelContext.contextKey;
    var context = appCtxSvc.getCtx( contextKey );
    var currentRuleDate = context.settingsCache.selectedRuleDate;
    let ruleDateTimeDetails = clonedData.ruleDateTimeDetails;

    let ruleDateOptions = clonedData.ruleDateOptions;
    if( [ 'latest', 'Default', 'null' ].includes( currentRuleDate ) ) {
        ruleDateOptions.dbValue = currentRuleDate;

        let lovEntry = clonedData.ruleDateList.dbValue.find( entry => entry.propInternalValue === currentRuleDate );
        ruleDateOptions.uiValue = lovEntry.propDisplayValue;
    } else {
        ruleDateOptions.dbValue = 'date';

        var utcSeconds = Number( currentRuleDate );
        var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
        dateTimeValue.setUTCSeconds( utcSeconds );

        // Update date&time
        ruleDateTimeDetails.dbValue = dateTimeValue;
        ruleDateTimeDetails.isArray = false;
        ruleDateTimeDetails.isEditable = true;
        ruleDateTimeDetails.dispValue = '';
        let dateUIValue = AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );
        ruleDateTimeDetails.uiValue = dateUIValue;
    }

    return { contextKey, ruleDateTimeDetails, ruleDateOptions };
};

/**
 * In case Date option is selected from fropdown, initializes with date value from context
 * If "No Rule Date", initialize with current date and time
 * @param {Object} data The ViewModel object of the Rule Date Sub view
 * @param {Object} selectedDateOption selected rule date from list
 * @returns {Object} ruleDateTimeDetails Rule Date time details
 */
export let updateRuleDateFromList = function( data, selectedDateOption ) {
    let ruleDateTimeDetails = {};
    if( String( selectedDateOption ) === 'date' ) {
        var context = appCtxSvc.getCtx( data.contextKey );
        var ruleDate = context.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ];
        var dateTimeValue;
        if( ruleDate === null || ruleDate === 'null' ) {
            dateTimeValue = Date.now();
        } else {
            if( data.contextKey !== 'fscContext' ) {
                var ruleDateUtcMilliSeconds = Date.parse( ruleDate ); // milliseconds are returned
                var utcSeconds = Math.floor( ruleDateUtcMilliSeconds / 1000 );
                var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
                dateTimeValue.setUTCSeconds( utcSeconds );
            } else {
                // In FSC date is expressed in epoch seconds
                var utcSeconds = Number( ruleDate );
                var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
                dateTimeValue.setUTCSeconds( utcSeconds );
            }
        }

        // Update date&time
        ruleDateTimeDetails.dbValue = dateTimeValue;
        ruleDateTimeDetails.isArray = false;
        ruleDateTimeDetails.isEditable = true;
        ruleDateTimeDetails.dispValue = '';
        ruleDateTimeDetails.uiValue =
            AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );
    }
    return ruleDateTimeDetails;
};

/**
 * VCV: update the selection on the context cache
 * Update Rule date on Perspective for other contexts
 * @param {Object} data The ViewModel object of the Rule Date subView
 */
export let applyRuleDateFromSubPanel = function( data ) {
    let deferred = AwPromiseService.instance.defer();
    var context = appCtxSvc.getCtx( data.contextKey );

    if( data.contextKey !== 'fscContext' ) {
        // Get date if selected rule date is "current" or "Date"
        // Trigger rule date update on perspective
        // Fire events to update link and reload variant expression data

        var values = [];
        if( data.ruleDateOptions.dbValue === 'latest' ) {
            var dateTimeNow = new Date();
            values.push( dateTimeNow.toISOString() );
        } else if( data.ruleDateOptions.dbValue === 'date' ) {
            // provide similar format: 2020-07-20T00:00:00-04:00
            var utcSeconds = Math.floor( data.ruleDateTimeDetails.dbValue / 1000 );
            var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
            dateTimeValue.setUTCSeconds( utcSeconds );
            values.push( dateTimeValue.toISOString() );
        } else if( data.ruleDateOptions.dbValue === 'Default' ) {
            values.push( '9999-12-30T00:00:00Z' );
        }

        // Register Policy to get Config Perspective with its properties
        var policyId = policySvc.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );

        var propName = 'cfg0RuleSetCompileDate';
        dmService.setProperties( [ {
            object: context.configPerspective,
            vecNameVal: [ {
                name: propName,
                values: values
            } ]
        } ] ).then( function( response ) {
            if( policyId ) {
                policySvc.unregister( policyId );
            }

            var updatedPerspective = _.find( response.ServiceData.modelObjects, {
                type: 'Cfg0ConfiguratorPerspective'
            } );
            context.configPerspective = updatedPerspective;
            var appliedRuleDate = updatedPerspective.props.cfg0RuleSetCompileDate;
            context.appliedSettings.configSettings.props.pca0RuleDate = appliedRuleDate;
            appCtxSvc.updateCtx( data.contextKey, context );

            // Fire events to reload variant expression data and update link
            eventBus.publish( 'Pca0FilterCriteriaSettings.filterCriteriaUpdated' );
            eventBus.publish( 'Pca0FilterCriteriaSettings.refreshContent' );
            deferred.resolve();
        }, function( err ) {
            deferred.reject( err );
            messagingService.showError( err + '<BR/>' );
        } );

        // Close panel
        var eventData = {
            source: 'toolAndInfoPanel'
        };
        eventBus.publish( 'complete', eventData );
    } else {
        // For FSC, convert rule Date into Date string if "Date" is selected
        var settingsCache = { ...context.settingsCache };

        if( data.ruleDateOptions.dbValue === 'date' ) {
            var utcSeconds = Math.floor( data.ruleDateTimeDetails.dbValue / 1000 );
            settingsCache.selectedRuleDate = utcSeconds;
            if( configuratorUtils.isPlatformVersionAtleast( 14, 1 ) ) {
                settingsCache.ruleDateTranslationMode = 'DateOnSVR';
            }
        } else {
            settingsCache.selectedRuleDate = data.ruleDateOptions.dbValue;
            if( configuratorUtils.isPlatformVersionAtleast( 14, 1 ) ) {
                if( data.ruleDateOptions.dbValue === 'latest' ) {
                    settingsCache.ruleDateTranslationMode = 'Latest';
                } else if( data.ruleDateOptions.dbValue === 'Default' ) {
                    settingsCache.ruleDateTranslationMode = 'System Default';
                } else if( data.ruleDateOptions.dbValue === 'null' ) {
                    settingsCache.ruleDateTranslationMode = 'No Rule Date';
                }
            }
        }
        appCtxSvc.updatePartialCtx( data.contextKey + '.settingsCache', settingsCache );

        // Trigger processing of Filter Criteria dirt flag
        eventBus.publish( 'Pca0RuleDate.ruleDateChanged' );

        // Need to close subForm
        var panelContext = {
            destPanelId: 'Pca0SettingsTab',
            recreatePanel: false
        };
        eventBus.publish( 'awPanel.navigate', panelContext );

        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * VCV scenario only
 * set Rule Date VM property when user closes RuleDate subView
 * @param {Object} data - vm model of the RevisionRule view
 * @return {Object} updated RuleDate ViewModel Property
 */
export let updateLocalData = function( data ) {
    var context = appCtxSvc.getCtx( data.contextKey );
    var currentRuleDateVMProp;
    var cachedRuleDate = context.settingsCache.selectedRuleDate;

    // Display "No Rule Date" for any context in case of null rule date
    if( cachedRuleDate === 'null' ) {
        var noRuleDateStr = configuratorUtils.getFscLocaleTextBundle().noRuleDate;
        currentRuleDateVMProp = getViewModelProperty( noRuleDateStr, 'STRING' );
    } else if( cachedRuleDate === 'latest' ) {
        var latestStr = configuratorUtils.getFscLocaleTextBundle().latest;
        currentRuleDateVMProp = getViewModelProperty( latestStr, 'STRING' );
    } else if( cachedRuleDate === 'Default' ) {
        var systemDefaultStr = configuratorUtils.getFscLocaleTextBundle().systemDefault;
        currentRuleDateVMProp = getViewModelProperty( systemDefaultStr, 'STRING' );
    } else {
        var utcSeconds = Number( cachedRuleDate );
        var dateTimeValue = new Date( 0 ); // The 0 there is the key, which sets the date to the epoch
        dateTimeValue.setUTCSeconds( utcSeconds );

        currentRuleDateVMProp = getViewModelProperty( dateTimeValue, 'DATE' );
        currentRuleDateVMProp.uiValue =
            AwFilterService.instance( 'date' )( dateTimeValue, dateTimeService.getSessionDateTimeFormat() );
    }

    // Initialize View Model Object for Current Rule Date
    return currentRuleDateVMProp;
};

/**
 * Toggle Rule Date Link State
 * @param {Boolean} isDisableRuleDateLink true - if Rule Date link state to be disabled
 * @return {Object} updated ViewModel ReadOnly Property
 */
export let toggleRuleDateLinkState = function( isDisableRuleDateLink ) {
    let isRuleDateFeatureReadOnly = {};
    isRuleDateFeatureReadOnly.dbValue = isDisableRuleDateLink;
    return { isRuleDateFeatureReadOnly };
};

/**
 * Date Configuration service utility
 * @param {Object} appCtxSvc - The appCtxSvc
 * @param {Object} uwPropertyService - The Property Service
 * @return {Object} exports
 */
export default exports = {
    initializeRuleDate,
    initializeRuleDateConfigurationData,
    navigateToRuleDateSub,
    initializeSubViewData,
    updateRuleDateFromList,
    applyRuleDateFromSubPanel,
    updateLocalData,
    toggleRuleDateLinkState
};
