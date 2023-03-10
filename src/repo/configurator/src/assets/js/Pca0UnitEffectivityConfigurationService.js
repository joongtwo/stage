// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0UnitEffectivityConfigurationService
 */
import appCtxSvc from 'js/appCtxService';
import ApsEffectivityValidationService from 'js/apsEffectivityValidationService';
import AwPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonConstants from 'js/pca0CommonConstants';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import policySvc from 'soa/kernel/propertyPolicyService';
import popupService from 'js/popupService';
import _ from 'lodash';

var exports = {};

/**
 * VCA scenario only
 * Get effectivity formula suitable as input for setProperties SOA
 * Maintain in the formula existing value for Date, if effectivity feature is "All"
 * @param {String} contextKey : Name of relevant context.
 * @param {String} startUnit : Effectivity unit Value/Range - Start unit
 * @param {String} endUnit : Effectivity unit Value/Range - End unit
 */

var getEffectivityFormula = function( contextKey, startUnit, endUnit ) {
    var effectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForUnit( startUnit, endUnit );

    var context = appCtxSvc.getCtx( contextKey );
    if( context.effectivityFeature === 'All' ) {
        // Maintain Date effectivity
        var cachedEffectivity = { ...context.settingsCache.effectivityInfo };
        var startDate = cachedEffectivity.currentStartEffDates.dbValues[ 0 ];
        var endDate = cachedEffectivity.currentEndEffDates.dbValues[ 0 ];
        var dateEffectivityFormula = Pca0FilterCriteriaSettingsService.getEffectivityFormulaForDate( startDate, endDate );
        if( dateEffectivityFormula !== '' ) {
            if( effectivityFormula !== '' ) {
                effectivityFormula += ' & ';
            }
            effectivityFormula += dateEffectivityFormula;
        }
    }
    return effectivityFormula;
};

/**
 * Initialize View Model properties
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 * @param {String} contextKey context key
 * @return {Object} Unit Effectivity VM property Info container
 */
var initializeVMProps = function( data, contextKey ) {
    // Get VM property for current Effectivity
    var currentEffectivity = Pca0FilterCriteriaSettingsService.getEffectivityDisplayInfo( contextKey ? contextKey : data.contextKey, 'UnitOnly' );

    // Set value to be displayed in the widget: this way, we allow the user to clear value of unit effectivity
    // We reverse-process string calculated in _apsCoreSvc.getDecoratedUnitEffectivityDisplayStr
    var apsResource = 'ApsEffectivityMessages';
    var apsLocalTextBundle = localeSvc.getLoadedText( apsResource );

    let widgetUnitRange = _.cloneDeep( data.widgetUnitRange );
    if( currentEffectivity.dbValue !== apsLocalTextBundle.ALL_UNITS ) {
        widgetUnitRange.dbValue = currentEffectivity.dbValue.replace( apsLocalTextBundle.UNIT_PREFIX, '' );
    }

    return { currentEffectivity, widgetUnitRange };
};

/**
 * Initialize the Unit Effectivity Configuration Section
 * Select value as from appliedSettings
 * Settings cache for selected Effectivity has been already initialized in Filter Criteria Service
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 * @param {Object} subPanelContext - subPanelContext
 * @return {Object} Unit Effectivity Info container
 */
export let initializeUnitEffectivityConfigurationData = function( data, subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = subPanelContext.isConfigurationReadOnly.dbValue;

    var context = appCtxSvc.getCtx( contextKey );
    if( subPanelContext.contextKey !== 'fscContext' && ( !context || _.isUndefined( context.appliedSettings ) ) ) {
        return;
    }

    let { currentEffectivity, widgetUnitRange } = initializeVMProps( data, contextKey );
    currentEffectivity.isEditable = !subPanelContext.isConfigurationReadOnly.dbValue;

    return { contextKey, isEffectivityReadOnly, currentEffectivity, widgetUnitRange };
};

/**
 * non-VCV: trigger update in perspective
 * VCV: update the selection on the context cache
 * Update Effectivity unit/range on Perspective for other contexts
 * @param {Object} data - The ViewModel object of the Unit Effectivity view
 */
export let applyUnitEffectivity = function( data ) {
    let deferred = AwPromiseService.instance.defer();
    var context = appCtxSvc.getCtx( data.contextKey );
    var needToClosePopup = false;

    // Do not proceed if validation Criteria are not satisfied
    // uncomment when ValidationCriteria will support functions (call checkValidUnitRangeEffectivity)
    // var invalidState = false;
    // var conditions = data.getConditionStates();
    // if( conditions.isNotInRegexp ) {
    //     invalidState = true;
    //     break;
    // }

    // Need to validate from apsCore because , as of now, numeric range validation cannot be performed through ValidationCriteria
    // Remove all spaces from the given string
    // Accept empty string as valid (no effectivity)
    var errorMsg = null;
    var unitEffValue = data.widgetUnitRange.dbValue;
    var apsResource = 'ApsEffectivityMessages';
    var apsLocalTextBundle = localeSvc.getLoadedText( apsResource );
    if( unitEffValue !== '' ) {
        unitEffValue = unitEffValue.replace( /\s+/g, '' );
        errorMsg = ApsEffectivityValidationService.instance.checkValidUnitRangeEffectivity( unitEffValue, apsLocalTextBundle );
    }

    if( errorMsg !== null ) {
        deferred.reject( errorMsg );
        messagingService.showError( errorMsg );
    } else {
        var effectivityRange = ApsEffectivityValidationService.instance.getUnitRangesFromEffectivityString( data.widgetUnitRange.dbValue );
        var startEffStr = effectivityRange.startUnit;
        var endEffStr = effectivityRange.endUnit;

        if( data.contextKey !== 'fscContext' ) {
            // Get Formula for setProperties
            // Trigger effectivity update on perspective
            // Fire events to update link and reload variant expression data
            var effectivityFormula = getEffectivityFormula( data.contextKey, startEffStr, endEffStr );

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
            needToClosePopup = true;
        } else {
            // Fix for LCS-537591: Handle UP and SO end unit effectivity scenarios
            // Decrement End Unit value when UP or SO
            // And update the values in settingsCache to be used for SOA input
            if( endEffStr === ApsEffectivityValidationService.instance.SO_UNIT_VAL ||
                endEffStr === ApsEffectivityValidationService.instance.UP_UNIT_VAL ) {
                var endUnitInt = parseInt( endEffStr );
                endUnitInt--;
                endEffStr = endUnitInt.toString();
            }
            // Update cached value
            var settingsCache = { ...context.settingsCache };
            settingsCache.effectivityInfo.currentStartEffUnits.dbValues[ 0 ] = startEffStr;
            settingsCache.effectivityInfo.currentEndEffUnits.dbValues[ 0 ] = endEffStr;

            // If UnitOnly, delete any other content for Dates
            // Leave Date info otherwise
            if( context.effectivityFeature === 'UnitOnly' ) {
                settingsCache.effectivityInfo.currentStartEffDates.dbValues = [ '' ];
                settingsCache.effectivityInfo.currentEndEffDates.dbValues = [ '' ];
            }
            appCtxSvc.updatePartialCtx( data.contextKey + '.settingsCache', settingsCache );

            // Trigger processing of Filter Criteria dirt flag and VM Property update
            eventBus.publish( 'Pca0UnitEffectivity.effectivityChanged' );

            deferred.resolve();
            needToClosePopup = true;
        }
    }
    if( needToClosePopup ) {
        popupService.hide();
    }
    return deferred.promise;
};

/**
 * VCV scenario only
 * Updates view model data when user closes Effectivity Unit Range popup
 * @param {Object} data - The ViewModel object of the Effectivity Unit view
 * @return {Object} Unit Effectivity VM property Info container
 */
export let updateUnitEffectivityVMProperty = function( data ) {
    return initializeVMProps( data );
};

/**
 * Toggle Unit Effectivity Link State
 * @param {Object} data - The ViewModel object of the Unit Effectivity View
 * @param {Boolean} isDisableEffectivityLink     true - if Unit Effectivity link state to be disabled
 *                                              false - if Unit Effectivity link state to be enabled
 */
export let toggleEffectivityLinkState = function( isDisableEffectivityLink ) {
    let isEffectivityReadOnly = {};
    isEffectivityReadOnly.dbValue = isDisableEffectivityLink;
    return { isEffectivityReadOnly };
};

export default exports = {
    initializeUnitEffectivityConfigurationData,
    applyUnitEffectivity,
    updateUnitEffectivityVMProperty,
    toggleEffectivityLinkState
};
