// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0DateEffectivityConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import AwPromiseService from 'js/awPromiseService';
import commandPanelService from 'js/commandPanel.service';
import configuratorUtils from 'js/configuratorUtils';
import dateTimeSvc from 'js/dateTimeService';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import messagingService from 'js/messagingService';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import policySvc from 'soa/kernel/propertyPolicyService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import _ from 'lodash';

var exports = {};

/**
 * Implementing own version of ApsEffectivityValidationService.populateDateRangeEffectivityDates
 * Method from ApsEffectivityValidationService is setting endDate equal to startDte if they differ from 1 day
 * Populates existing effectivity into start and end date widgets
 *
 * @param {Object} effectivityInfo : Existing Effectivity
 * @param {Date} startDate : Start Date
 * @param {Date} endDate : End Date
 * @param {String} endDateOptions: End date option (dropdown)
 */
var populateDateRangeEffectivityDates = function( effectivityInfo, clonedData ) {
    let startDate = clonedData.startDate;
    let endDate = clonedData.endDate;
    let endDateOptions = clonedData.endDateOptions;

    var sDateStr = effectivityInfo.currentStartEffDates.dbValues[ 0 ];
    var eDateStr = effectivityInfo.currentEndEffDates.dbValues[ 0 ];

    startDate.dbValue = new Date( sDateStr ).getTime();
    startDate.dateApi.dateObject = dateTimeSvc.getJSDate( startDate.dbValue );

    if( eDateStr !== null &&
        ( eDateStr.indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_UP_DATE ) !== -1 || eDateStr
            .indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_DATE_DECEMBER_29 ) !== -1 ) ) {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.UP;
        endDateOptions.uiValue = getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.UP );
    } else if( eDateStr !== null &&
        ( eDateStr.indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_SO_DATE ) !== -1 || eDateStr
            .indexOf( ApsEffectivityValidationService.instance.EFFECTIVITY_DATE_DECEMBER_25 ) !== -1 ) ) {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.SO;
        endDateOptions.uiValue = getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.SO );
    } else {
        endDateOptions.dbValue = ApsEffectivityValidationService.instance.DATE;
        endDateOptions.uiValue = getEndDateOptionsLabel( clonedData, ApsEffectivityValidationService.instance.DATE );
        endDate.dbValue = new Date( eDateStr ).getTime();
        endDate.dateApi.dateObject = dateTimeSvc.getJSDate( endDate.dbValue );
    }
};

var getEndDateOptionsLabel = function( clonedData, dbValue ) {
    let lovEntry = clonedData.endDateList.dbValue.find( entry => entry.propInternalValue === dbValue );
    return lovEntry.propDisplayValue;
};

/**
 * VCA scenario only
 * Get effectivity formula suitable as input for setProperties SOA
 * Maintain in the formula existing value for Unit, if effectivity feature is "All"
 * @param {String} contextKey : Name of relevant context.
 * @param {String} startDate : Effectivity date Range - Start date
 * @param {String} endDate : Effectivity date Range - End date
 * @param {String} endEffectivityOption : Effectivity date Range - End date options (Date/SO/UP)
 */
var getEffectivityFormula = function( contextKey, startDate, endDate, endEffectivityOption ) {
    // Date formula calculatio is not exposed in FilterCriteria as it strongly depends on dateAPIs
    var effectivityFormula = '';

    // Get start Date String
    var startDateString = ApsEffectivityValidationService.instance.getStringFromDate( startDate.dateApi.dateObject );

    if( startDateString.length !== 0 ) {
        effectivityFormula += '[Teamcenter::]Date >= ' + startDateString;
    }

    if( endEffectivityOption === ApsEffectivityValidationService.instance.UP ) {
        // _UP_DATE_WITH_TIME_IN_GMT = "9999-12-30T00:00:00+00:00";
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }
        effectivityFormula += '[Teamcenter::]Date < 9999-12-30T00:00:00+00:00';
    } else if( endEffectivityOption === ApsEffectivityValidationService.instance.SO ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }
        effectivityFormula += '[Teamcenter::]Date < 9999-12-26T00:00:00+00:00';
    } else {
        var endDateString = ApsEffectivityValidationService.instance.getStringFromDate( endDate.dateApi.dateObject );

        if( endDateString.length !== 0 ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }

            if( dateTimeSvc.compare( startDate.dateApi.dateObject, endDate.dateApi.dateObject ) === 0 ) {
                // Single Date effectivity, Get next Date
                var endDateAsNextDate = new Date();
                endDateAsNextDate.setDate( startDate.dateApi.dateObject.getDate() + 1 );
                endDateAsNextDate.setHours( 0 );
                endDateAsNextDate.setMinutes( 0 );
                endDateAsNextDate.setSeconds( 0 );
                endDateString = ApsEffectivityValidationService.instance.getStringFromDate( endDateAsNextDate );
            }
            effectivityFormula += '[Teamcenter::]Date < ' + endDateString;
        }
    }

    var context = appCtxSvc.getCtx( contextKey );

    if( context.effectivityFeature === 'All' ) {
        // Maintain Unit effectivity
        var cachedEffectivity = context.settingsCache.effectivityInfo;
        var startUnit = cachedEffectivity.currentStartEffUnits.dbValues[ 0 ];
        var endUnit = cachedEffectivity.currentEndEffUnits.dbValues[ 0 ];

        var unitEffectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForUnit( startUnit, endUnit );
        if( unitEffectivityFormula !== '' ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }
            effectivityFormula += unitEffectivityFormula;
        }
    }
    return effectivityFormula;
};

/**
 * Initialize the Date Effectivity Configuration Section
 * This is called on onMount:
 * - opening Settings Panel
 * - on closure of Date Effectivity Range subpanel
 * Select value as from appliedSettings
 * Settings cache for selected Effectivity has been already initialized in Filter Criteria Service
 * @param {Object} subPanelContext - subPanelContext
 * @return {Object} Date Effectivity Info container
 */
export let initializeDateEffectivityConfigurationData = function( subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = subPanelContext.isConfigurationReadOnly.dbValue;

    var context = appCtxSvc.getCtx( contextKey );
    if( subPanelContext.contextKey !== 'fscContext' && ( !context || _.isUndefined( context.appliedSettings ) ) ) {
        return;
    }

    // Get VM property for current Effectivity
    let currentEffectivity = Pca0FilterCriteriaSettingsService.getEffectivityDisplayInfo( contextKey, 'DateOnly' );
    currentEffectivity.isEditable = !subPanelContext.isConfigurationReadOnly.dbValue;

    return { contextKey, isEffectivityReadOnly, currentEffectivity };
};

/**
 * Navigate to Effectivity Date Range Sub View
 * @param {Object} data - The ViewModel object of the Effectivity Date view
 */
export let navigateToEffectivityDateRangeSub = function( data ) {
    var panelContext = {
        destPanelId: data.contextKey !== 'fscContext' ? 'Pca0DateRangeEffectivityPanel' : 'Pca0DateRangeEffectivityCommandSub',
        title: configuratorUtils.getFscLocaleTextBundle().effectivityDateRange,
        contextKey: data.contextKey,
        recreatePanel: true,
        supportGoBack: data.contextKey === 'fscContext'
    };

    if( data.contextKey !== 'fscContext' ) {
        commandPanelService.activateCommandPanel( 'Pca0DateRangeEffectivityPanel', 'aw_toolsAndInfo', panelContext );
    } else {
        eventBus.publish( 'awPanel.navigate', panelContext );
    }
};

/**
 * Initialize data for the subView in use in VCA/VCV context.
 * @param {Object} data - The ViewModel object of the Effectivity Date Range subView
 * @return {Object} Effectivity Date Range subview info container
 */
export let initializeSubViewData = function( data ) {
    var panelContext = appCtxSvc.getCtx( 'panelContext' );
    let contextKey = panelContext.contextKey;
    var context = appCtxSvc.getCtx( contextKey );
    var settingsCache = context.settingsCache;
    let clonedData = _.cloneDeep( data );
    populateDateRangeEffectivityDates( settingsCache.effectivityInfo, clonedData );
    let startDate = clonedData.startDate;
    let endDate = clonedData.endDate;
    let endDateOptions = clonedData.endDateOptions;
    return { contextKey, startDate, endDate, endDateOptions };
};

/**
 * non-VCV: trigger update in perspective
 * VCV: update the selection on the context cache
 * Update Effectivity date range on Perspective for other contexts
 * @param {Object} data The ViewModel object of the Effectivity Date Range subView
 */
export let applyDateRangeEffectivityFromSubPanel = function( data ) {
    let deferred = AwPromiseService.instance.defer();
    var context = appCtxSvc.getCtx( data.contextKey );

    if( data.contextKey !== 'fscContext' ) {
        // Get Formula for setProperties
        // Trigger effectivity update on perspective
        // Fire events to update link and reload variant expression data
        var effectivityFormula = getEffectivityFormula( data.contextKey, data.startDate, data.endDate, data.endDateOptions.dbValue );

        // Register Policy to get Config Perspective with its properties
        var policyId = policySvc.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );
        var propName = 'cfg0RuleSetEffectivity';
        dmService.setProperties( [ {
            object: context.configPerspective,
            vecNameVal: [ {
                name: propName,
                values: [ effectivityFormula ]
            } ]
        } ] ).then( function( response ) {
            if( policyId ) {
                policySvc.unregister( policyId );
            }

            var updatedPerspective = _.find( response.ServiceData.modelObjects, {
                type: 'Cfg0ConfiguratorPerspective'
            } );
            context.configPerspective = updatedPerspective;
            var appliedEffectivity = updatedPerspective.props.cfg0RuleSetEffectivity;
            context.appliedSettings.configSettings.props.pca0Effectivity = appliedEffectivity;
            appCtxSvc.updateCtx( data.contextKey, context );

            // Re-initialize effectivity
            configuratorUtils.initializeCache( data.contextKey );
            Pca0FilterCriteriaSettingsService.initializeEffectivity( data.contextKey );

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
        var effectivityRange = ApsEffectivityValidationService.instance.getDateRangesFromEffectivityDates( data.startDate, data.endDate, data.endDateOptions.dbValue );
        var startJSDate;
        var endJSDate;

        if( effectivityRange.startDate === ApsEffectivityValidationService.instance.NULLDATE_WITH_TIME ) {
            startJSDate = '';
        } else {
            startJSDate = effectivityRange.startDate;
        }

        // UP
        // "UP" value for date effectivity with time format in GMT. */
        // _UP_DATE_WITH_TIME_IN_GMT = "9999-12-30T00:00:00+00:00";
        if( data.endDateOptions.dbValue === ApsEffectivityValidationService.instance.UP ) {
            endJSDate = '9999-12-30T00:00:00+00:00';
        }

        // SO
        // "SO" (Stock Out) value for date effectivity with time format in GMT. */
        // _SO_DATE_WITH_TIME_IN_GMT = "9999-12-26T00:00:00+00:00";
        else if( data.endDateOptions.dbValue === ApsEffectivityValidationService.instance.SO ) {
            endJSDate = '9999-12-26T00:00:00+00:00';
        } else {
            if( effectivityRange.endDate === ApsEffectivityValidationService.instance.NULLDATE_WITH_TIME ) {
                endJSDate = '';
            } else {
                endJSDate = effectivityRange.endDate;
            }
        }

        // Update cached value
        context = appCtxSvc.getCtx( data.contextKey );
        var settingsCache = { ...context.settingsCache };
        settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = startJSDate;
        settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = endJSDate;

        // If DateOnly, delete any other content for Units
        // Leave Unit info otherwise
        if( context.effectivityFeature === 'DateOnly' ) {
            settingsCache.effectivityInfo.currentStartEffUnits.dbValues = [ '-1' ];
            settingsCache.effectivityInfo.currentEndEffUnits.dbValues = [ '-1' ];
        }
        appCtxSvc.updatePartialCtx( data.contextKey + '.settingsCache', settingsCache );

        // Trigger processing of Filter Criteria dirt flag
        eventBus.publish( 'Pca0DateEffectivity.effectivityChanged' );

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
 * Toggle Date Effectivity Link State
 * @param {Boolean} isDisableEffectivityLink     true - if Effectivity link state to be disabled
 *                                              false - if Effectivity link state to be enabled
 * @returns {Object} read-only VM property
 *  */
export let toggleEffectivityLinkState = function( isDisableEffectivityLink ) {
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = isDisableEffectivityLink;
    return { isEffectivityReadOnly };
};

export default exports = {
    initializeDateEffectivityConfigurationData,
    navigateToEffectivityDateRangeSub,
    initializeSubViewData,
    applyDateRangeEffectivityFromSubPanel,
    toggleEffectivityLinkState
};
