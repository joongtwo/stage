// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Pca0FilterCriteriaSettingsService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityAuthoringService from 'js/apsEffectivityAuthoringService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import eventBus from 'js/eventBus';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import utils from 'js/Pca0SettingsUtilsService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

var exports = {};

/**
 * Init the configuration settings object after retrieving the setting data from the server
 * Update context
 *
 * @param {Object} subPanelContextInfo - The view model object information from calling View
 */
export let initViewDataSettings = function( subPanelContextInfo ) {
    var context = appCtxSvc.getCtx( subPanelContextInfo.contextKey );

    // Effectivity feature is part of AW startup preferences
    var ctxPreferences = appCtxSvc.getCtx( 'preferences' );
    var effectivityFeature = ctxPreferences.PCA_effectivity_shown_columns[ 0 ];
    context.effectivityFeature = effectivityFeature;
    appCtxSvc.updateCtx( subPanelContextInfo.contextKey, context );
};

/**
 * Initialize effectivity
 * Based on values from settings or settingsMO, populate settingsCache
 * @param {String} contextKey : Name of relevant context.
 */
export let initializeEffectivity = function( contextKey ) {
    var context = appCtxSvc.getCtx( contextKey );
    var configSettings = context.appliedSettings.configSettings;
    var settingsCache = { ...context.settingsCache };
    var settingsEffectivity = configSettings.props.pca0Effectivity;

    if( contextKey !== Pca0Constants.FSC_CONTEXT ) {
        // Effectivity is provided in following format
        // "[Teamcenter::]Date >= 2020-07-15T00:00:00-0400 & [Teamcenter::]Date < 9999-12-30T00:00:00+00:00"

        var effectivityValue = settingsEffectivity.dbValues[ 0 ];
        if( effectivityValue !== null ) {
            var tokens = settingsEffectivity.dbValues[ 0 ].split( ' & ' );
            var dateGTE = '[Teamcenter::]Date >= ';
            var dateGT = '[Teamcenter::]Date > ';
            var dateLTE = '[Teamcenter::]Date <= ';
            var dateLT = '[Teamcenter::]Date < ';
            var unitGTE = '[Teamcenter::]Unit >= ';
            var unitGT = '[Teamcenter::]Unit > ';
            var unitLTE = '[Teamcenter::]Unit <= ';
            var unitLT = '[Teamcenter::]Unit < ';
            var unitEQ = '[Teamcenter::]Unit = ';

            for( var idx = 0; idx < tokens.length; idx++ ) {
                // dateGTE: [Date >=]
                if( tokens[ idx ].includes( dateGTE ) ) {
                    settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateGTE, '' );
                }
                // dateGT: [Date >]
                else if( tokens[ idx ].includes( dateGT ) ) {
                    settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateGT, '' );
                }
                // dateLTE: [Date <=]
                else if( tokens[ idx ].includes( dateLTE ) ) {
                    settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateLTE, '' );
                }
                // dateLT: [Date <]
                else if( tokens[ idx ].includes( dateLT ) ) {
                    settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = tokens[ idx ].replace( dateLT, '' );
                }
                // unitGTE: [Unit >=]
                else if( tokens[ idx ].includes( unitGTE ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitGTE, '' );
                }
                // unitGT: [Unit >]
                else if( tokens[ idx ].includes( unitGT ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitGT, '' );
                }
                // unitLTE: [Unit <=]
                else if( tokens[ idx ].includes( unitLTE ) ) {
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitLTE, '' );
                }
                // unitLT: [Unit <]
                else if( tokens[ idx ].includes( unitLT ) ) {
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitLT, '' );
                }
                // unitEQ: [Unit =]
                else if( tokens[ idx ].includes( unitEQ ) ) {
                    settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = tokens[ idx ].replace( unitEQ, '' );
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
                }
            }

            // ToDo: LCS-535186 - Implement unit effectivity processing based on From/To and In/Out modes in Tc platform.
            // Non-VCV specific: Check for From/To
            // if From/To: Decrementing the end value by one to display it back to its original input value
            // which was incremented in input formula to include end value in getEffectivityFormulaForUnit().
            if( ApsEffectivityValidationService.instance.isUnitEffectivityFromToMode() ) {
                var endUnit = settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
                var startUnit = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];

                // To/From or In/out should not be considered for UP/SO values.
                if( endUnit !== ApsEffectivityValidationService.instance.UP_UNIT_VAL &&
                    endUnit !== ApsEffectivityValidationService.instance.SO_UNIT_VAL && startUnit !== endUnit ) {
                    var endUnitInt = parseInt( endUnit );
                    --endUnitInt;
                    settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endUnitInt.toString();
                }
            }
        }
    } else {
        // Effectivity is provided in following format
        // "dateIn..dateOut & unitIn..unitOut"
        var tokens = settingsEffectivity.dbValues[ 0 ].split( ' & ' );

        // Process Dates
        // Dates are in Zulu Time (UTC)
        // "2015-06-01T05:30:00Z..9999-12-30T00:00:00Z"; //2015-06-01..UP
        var effDateArray = tokens[ 0 ].split( '..' );
        var startEffDateStr = effDateArray.length >= 1 ? effDateArray[ 0 ] : '';
        var endEffDateStr = effDateArray.length === 2 ? effDateArray[ 1 ] : '';

        // Update cached value
        settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] = startEffDateStr;
        settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] = endEffDateStr;

        // Process Units
        // 1..10
        // ..10
        // 1..
        // 1..UP
        // ..SO
        var effUnitArray = tokens[ 1 ].split( '..' );
        var startEffUnitStr = effUnitArray.length >= 1 && effUnitArray[ 0 ] !== '' ? effUnitArray[ 0 ] : '-1';
        var endEffUnitStr = effUnitArray.length === 2 && effUnitArray[ 1 ] !== '' ? effUnitArray[ 1 ] : '-1';

        // Update cached value
        settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = startEffUnitStr;
        settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endEffUnitStr;
        configSettings.effectivityInfo = _.cloneDeep( settingsCache.effectivityInfo );
    }

    // Update context
    appCtxSvc.updatePartialCtx( contextKey + '.settingsCache', settingsCache );
};

/**
 * non-VCV scenario Only
 * Get effectivity formula suitable as input for setProperties SOA
 * Formula processed is for Effectivity Date only, from cached Values
 * @param {String} startDate : Effectivity date Range - Start date
 * @param {String} endDate : Effectivity date Range - End date
 */
export let getEffectivityFormulaForDate = function( startDate, endDate ) {
    var effectivityFormula = '';
    if( startDate.length !== 0 ) {
        effectivityFormula += '[Teamcenter::]Date >= ' + startDate;
    }

    if( endDate.length !== 0 ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }

        // Check for From/To vs In/Out
        // if From/To: Activates the inclusion of the end value
        if( ApsEffectivityValidationService.instance.isDateEffectivityFromToMode() ) {
            effectivityFormula += '[Teamcenter::]Date <= ';
        } else {
            effectivityFormula += '[Teamcenter::]Date < ';
        }
        effectivityFormula += endDate;
    }
    return effectivityFormula;
};

/**
 * non-VCV scenario Only
 * Get effectivity formula suitable as input for setProperties SOA
 * Formula processed is for Effectivity Unit part only
 * @param {String} startUnit : Effectivity unit Value/Range - Start unit
 * @param {String} endUnit : Effectivity unit Value/Range - End unit
 */

export let getEffectivityFormulaForUnit = function( startUnit, endUnit ) {
    if( startUnit !== '-1' && endUnit !== '-1' && startUnit === endUnit ) {
        return '[Teamcenter::]Unit = ' + startUnit;
    }

    var effectivityFormula = '';
    if( startUnit !== '-1' ) {
        effectivityFormula += '[Teamcenter::]Unit >= ' + startUnit;
    }

    if( endUnit !== '-1' ) {
        if( effectivityFormula !== '' ) {
            effectivityFormula += ' & ';
        }

        // ToDo: LCS-535186 - Implement unit effectivity processing based on From/To and In/Out modes in Tc platform.
        // non-VCV scenario- Check for From/To vs In/Out
        // if From/To: Activates the inclusion of the end value. To include the end value here we are incrementing the end value by one.
        // For instance input unit range is 1..100
        // The effectivity formula for From/To will be :  [Teamcenter::]Unit >= 1 &&  [Teamcenter::]Unit < 101 )
        // The effectivity formula for In/Out will be :  [Teamcenter::]Unit >= 1 &&  [Teamcenter::]Unit < 100 )
        if( ApsEffectivityValidationService.instance.isUnitEffectivityFromToMode() ) {
            if( endUnit !== ApsEffectivityValidationService.instance.UP_UNIT_VAL &&
                endUnit !== ApsEffectivityValidationService.instance.SO_UNIT_VAL ) {
                var endUnitInt = parseInt( endUnit );
                ++endUnitInt;
                endUnit = endUnitInt.toString();
            }
        }
        effectivityFormula += '[Teamcenter::]Unit < ' + endUnit;
    }
    return effectivityFormula;
};

/**
 * Handle selection change for Intents: TODO when intents is supported again
 *
 * @param {Object} data - The view model object
 */
export let handleIntentSelectionChange = function( data ) {
    // TODO
};

/**
 * VCV - Gets current and updated configuration settings from local Cache
 * These values will be sent back to server to be saved
 * @param {Object} variantRuleData variantRuleData atomic data
 * @returns {Object} enhanced array to use for saving the settings properties
 */
export let getFilterCriteriaToApply = function( variantRuleData ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var configSettingsProps = {};
    //if we lost the initial props due to panel being replaced and coming now from a rule date subpanel for example
    //use the stored config perspective on appctx
    let configPerspectiveUid = variantRuleData ? variantRuleData.value.configPerspective.uid : fscContext.currentConfigPerspective.uid;

    configSettingsProps.pca0ConfigPerspective = [ configPerspectiveUid ];
    var settingsCache = fscContext.settingsCache;
    if( settingsCache ) {
        // Revision Rule
        if( !_.isUndefined( settingsCache.selectedRevisionRule ) ) {
            // Sending to AW server selected RevisionRule UID
            configSettingsProps.pca0RevisionRule = [ settingsCache.selectedRevisionRule.uid ];
        } else {
            // Do not send Revision Rule if no change was done
        }

        // Rule Date
        // For "No Rule Date" and "System Default" trasmit back String Value
        // "No Rule Date" (selectedRuleDate: "null")
        // "System Default" (selectedRuleDate: "Default")
        var strRuleDate;
        if( typeof settingsCache.selectedRuleDate === 'string' ) {
            if( settingsCache.selectedRuleDate === 'latest' ) {
                var nowDate = new Date();
                strRuleDate = JSON.stringify( Math.floor( nowDate.getTime() / 1000 ) );
            } else {
                strRuleDate = settingsCache.selectedRuleDate;
            }
        } else {
            strRuleDate = JSON.stringify( settingsCache.selectedRuleDate );
        }
        configSettingsProps.pca0RuleDate = [ strRuleDate ];

        // Effectivity: provide format like "dateIn..dateOut & unitIn..unitOut"
        var strEffectivity = '';

        // Process Effectivity Dates: for "DateOnly" and "All"
        if( fscContext.effectivityFeature !== 'UnitOnly' ) {
            // We need to provide a ISO-8601 format with indication of Z time
            // Issue on server when setting a ISO string formatted with milliseconds: 2015-03-04T00:00:00.000Z
            var startDateUTC = '';
            var endDateUTC = '';
            if( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] !== '' ) {
                var startDateGMT = new Date( settingsCache.effectivityInfo.currentStartEffDates.dbValues[ 0 ] );
                startDateUTC = new Date( startDateGMT ).toISOString().slice( 0, -5 ) + 'Z';
            }
            if( settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ] !== '' ) {
                var endDateGMTStr = settingsCache.effectivityInfo.currentEndEffDates.dbValues[ 0 ];

                // If UP ("9999-12-30T00:00:00") or StockOut ("9999-12-26T00:00:00") are used, do not convert, just add Z
                if( endDateGMTStr === ApsEffectivityValidationService.instance.EFFECTIVITY_UP_DATE_WITH_TIME || endDateGMTStr === ApsEffectivityValidationService.instance
                    .EFFECTIVITY_SO_DATE_WITH_TIME ) {
                    endDateUTC = endDateGMTStr + 'Z';
                } else {
                    var endDateGMT = new Date( endDateGMTStr );
                    endDateUTC = new Date( endDateGMT ).toISOString().slice( 0, -5 ) + 'Z'; // need to provide format: "2019-06-01T05:30:00Z"
                }
            }
            var dateRangeStrStr = startDateUTC + '..' + endDateUTC;
            var effDateStr = dateRangeStrStr !== '..' ? dateRangeStrStr : '';
            strEffectivity = effDateStr;
        }

        // Add delimiter
        strEffectivity += ' & ';

        // Process Effectivity Units: for "UnitOnly" and "All"
        if( fscContext.effectivityFeature !== 'DateOnly' ) {
            // Units can have unitIn and/or unitOut
            var unitIn = settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ];
            var unitInStr = unitIn !== '-1' ? unitIn : '';
            var unitOut = settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
            var unitOutStr = unitOut !== '-1' ? unitOut : '';

            var unitStr = unitInStr + '..' + unitOutStr;
            var effUnit = unitStr !== '..' ? unitStr : '';

            strEffectivity += effUnit;
        }
        configSettingsProps.pca0Effectivity = [ strEffectivity ];
    }
    return configSettingsProps;
};

/**
 * Get intents level list
 * @param {Object} lov - lov for Intents as from server response
 * @returns {Object} Lov List
 */
export let getIntentList = function( lov ) {
    return utils.getSettingsLovList( lov );
};

/**
 * Create and get a view model property based on current effectivity
 * Code has been copied and adapted from occmgmt4js/fgfConfigurationService
 *
 * @param {String} contextKey : Name of relevant context.
 * @param {String} effectivityFeature : Effectivity feature currently processing.
 * @return {Object} Property: current effectivity view model property
 * NOTE: It might contain mixed date/unit information if preference PCA_Effectivity_shown_columns changed value DateOnly/UnitOnly/All
 * This might occur on first load, before any user changes: in this case, proper formatting is applied
 */
export let getEffectivityDisplayInfo = function( contextKey, effectivityFeature ) {
    var context = appCtxSvc.getCtx( contextKey );
    var effectivityInfo = context.settingsCache.effectivityInfo;
    var endUnit = effectivityInfo.currentEndEffUnits.dbValues[ 0 ];
    var vmProperty;

    // Get Effectivity feature currently processing
    switch ( effectivityFeature ) {
        case 'DateOnly':
            var currentlyAppliedDateEffStr = ApsEffectivityAuthoringService.getDecoratedDateEffectivityDisplayStr(
                effectivityInfo.currentStartEffDates.dbValues[ 0 ], effectivityInfo.currentEndEffDates.dbValues[ 0 ] );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedDateEffStr, currentlyAppliedDateEffStr, 'STRING', currentlyAppliedDateEffStr, '' );
            vmProperty.uiValue = currentlyAppliedDateEffStr;
            break;

        case 'UnitOnly':

            // Fix for LCS-537591: Handle UP and SO end unit effectivity scenarios
            // Increment End Unit value when UP or SO
            // Use endUnit to display the value in UI
            if( contextKey === Pca0Constants.FSC_CONTEXT &&
                ( endUnit === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                    ( parseInt( ApsEffectivityValidationService.instance.SO_UNIT_VAL ) - 1 ).toString() === endUnit ) ) {
                let endUnitInt = parseInt( endUnit );
                endUnitInt++;
                endUnit = endUnitInt.toString();
            }
            var currentlyAppliedUnitEffStr = ApsEffectivityAuthoringService.getDecoratedUnitEffectivityDisplayStr(
                effectivityInfo.currentStartEffUnits.dbValues[ 0 ], endUnit );

            // Now create the VM property with this display name.
            vmProperty = uwPropertyService.createViewModelProperty(
                currentlyAppliedUnitEffStr, currentlyAppliedUnitEffStr, 'STRING', currentlyAppliedUnitEffStr, '' );
            vmProperty.uiValue = currentlyAppliedUnitEffStr;
            vmProperty.isEditable = true; // needs to be set explicitly as the default is false
            break;

        default:
            vmProperty = uwPropertyService.createViewModelProperty(
                '', '', 'STRING', '', '' );
            vmProperty.uiValue = '';
    }
    return vmProperty;
};

/**
 * VCV scenario only
 * Update flag on fscContext.settingsCache for changes in Filter Criteria
 */
export let filterCriteriaModified = function() {
    if( _.isUndefined( appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ) ) || _.isUndefined( appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT ).settingsCache ) ) {
        return;
    }
    const context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let settingsCache = { ...context.settingsCache };

    if( typeof settingsCache.selectedRuleDate === 'number' ) {
        settingsCache.selectedRuleDate = String( settingsCache.selectedRuleDate );
    }
    const ruleDateChanged = context.appliedSettings.configSettings.props.pca0RuleDate.dbValues[ 0 ] !== settingsCache.selectedRuleDate;
    const effectivityChanged = !_.isEqual( context.appliedSettings.configSettings.effectivityInfo, settingsCache.effectivityInfo );

    // SettingsCache contains the updated RevisionRule, if the user made a change.
    let revisionRuleChanged;
    revisionRuleChanged = !_.isUndefined( settingsCache.selectedRevisionRule );

    if( revisionRuleChanged || ruleDateChanged || effectivityChanged ) {
        settingsCache.filterCriteriaModified = true;
    } else {
        settingsCache.filterCriteriaModified = false;
    }
    appCtxSvc.updatePartialCtx( 'fscContext.settingsCache', settingsCache );
};

/**
 * Toggle Filter Criteria Settings State
 * @param {Object} subPanelContextInfo - sub panel context Info container
 * @param {Boolean} eventMap  event data container
 * @returns {Object} updated subPanelContext info
 */
export let toggleFilterCriteriaSettingsState = function( subPanelContextInfo, eventMap ) {
    let key = 'Pca0Settings.toggleFilterCriteriaSettingsState';
    let eventData = pca0CommonUtils.getEventDataFromEventMap( eventMap, key );
    let isDisableFilterCriteria = eventData.isReadOnlyMode;

    subPanelContextInfo.isConfigurationReadOnly.dbValue = isDisableFilterCriteria;

    // Publish event(s) to toggle specific Filter Criteria Settings
    var revRuleEventData = {
        isDisableRevisionRuleLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0RevisionRule.toggleRevisionRuleLinkState', revRuleEventData );
    var ruleDateEventData = {
        isDisableRuleDateLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0RuleDate.toggleRuleDateLinkState', ruleDateEventData );
    var dateEffectivityEventData = {
        isDisableEffectivityLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0DateEffectivity.toggleEffectivityLinkState', dateEffectivityEventData );
    var unitEffectivityEventData = {
        isDisableEffectivityLink: isDisableFilterCriteria
    };
    eventBus.publish( 'Pca0UnitEffectivity.toggleEffectivityLinkState', unitEffectivityEventData );

    return { subPanelContextInfo };
};

export default exports = {
    initViewDataSettings,
    initializeEffectivity,
    getEffectivityFormulaForDate,
    getEffectivityFormulaForUnit,
    handleIntentSelectionChange,
    getFilterCriteriaToApply,
    getIntentList,
    getEffectivityDisplayInfo,
    filterCriteriaModified,
    toggleFilterCriteriaSettingsState
};
