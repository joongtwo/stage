/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0Scopes View
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0FeaturesService
 */
import appCtxSvc from 'js/appCtxService';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import Pca0Family from 'viewmodel/Pca0FamilyViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwPanel from 'viewmodel/AwPanelViewModel';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import commandPanelService from 'js/commandPanel.service';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import dateTimeService from 'js/dateTimeService';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/Pca0ExpressionGridService';
import iconSvc from 'js/iconService';
import pca0Constants from 'js/Pca0Constants';
import viewModelObjectService from 'js/viewModelObjectService';

import { getField } from 'js/utils';
import $ from 'jquery';
import _ from 'lodash';

/* eslint-disable complexity */

var exports = {};
var _scope = null;

var VCV_TOOLBAR_ACTIONS = {
    VALIDATE: 'validate',
    EXPAND: 'expand',
    SWITCHINGTOMANUAL: 'switchingToManual'
};
/**
 * Returns updated scope from free-form changes
 * @param {Object} data - The view data
 * @param {Object} eventData - The response received by SOA service
 * @returns {Object} - Returns the option group objects which will be rendered on features panel
 */
export let getScope = function() {
    return { group: _scope };
};

/**
 * This API processes the cached server response and constructs the client data model
 * This is used:
 * - when loading first scope (entering VCV for the first time or after loading SVR)
 * - when navigating to a family for completeness check (variability data is cached)
 * @param {Object} data - The view data
 * @param {Object} eventData - The response received by SOA service
 * @param {Object} fscState - The fscState
 * @returns {Object} - Returns the option group objects which will be rendered on features panel
 */
export let getCachedScopeData = function( data, eventData, fscState ) {
    // Load first scope
    var scopeStruct = exports.getScopeData( eventData.soaResponse, data, fscState );

    // Once soaResponse is used to getScope, delete it from eventData
    // as eventData.soaResponse ( check shouldLoadScopeDataFromServerCondition ) is also a deciding factor whether to make a soa call
    // or just to load scope from cached scope.
    // For ex. The soa call should be made for next required family when scope is changed
    // But, if we don't delete eventData.soaResponse, no SOA call will be made and that is not right as we do not have new scope data.
    delete eventData.soaResponse;
    // populate Group Meta
    var groupMeta = exports.getGroupMeta();

    return {
        scopeStruct: scopeStruct,
        groupMeta: groupMeta
    };
};

/**
 * This API updates the selection state of features of families in the scope object
 * @param {Object} selectedExpressions - One of the field of response received by SOA service
 * @param {Object} fscState fscState atomic data
 */
export let updateSelectionStateAndSetIndicatorsOnExistingScopeData = function( selectedExpressions, fscState ) {
    //First clear the system selection state
    let scopeStruct = exports.clearSystemSelectionsInManualMode( fscState );
    // Initially create a map of NodeUID and updated/latest selection state
    let tempScope = _.cloneDeep( scopeStruct.group );
    let mapNodeAndSelectionState = {};
    // In case of empty Validate, selectedExpressions is empty
    if( _.isEmpty( selectedExpressions ) ) {
        return;
    }
    let selectedExpression = _.values( selectedExpressions )[ 0 ];
    let configExprSet = selectedExpression[ 0 ].configExpressionSet;
    let configExprSection = configExprSet[ 0 ].configExpressionSections;
    let subExpression = configExprSection.length ? configExprSection[ 0 ].subExpressions[ 0 ] : null;
    if( subExpression === null ) {
        return;
    }
    let expressionGroups = subExpression.expressionGroups;
    _.forEach( _.keys( expressionGroups ), node => {
        let nodeMap = expressionGroups[ node ];
        // create a map of UID and selection state.
        _.forEach( nodeMap, ( obj ) => {
            // feature level selection state
            if( obj.nodeUid ) {
                mapNodeAndSelectionState[ obj.nodeUid ] = obj.selectionState;
            }
            // free form family selection state stored in family selection state
            else {
                mapNodeAndSelectionState[ obj.family ] = obj.selectionState;
            }
        } );
    } );
    // Update the selection state of scope with latest selection state
    _.forEach( tempScope.families, ( family, outerIndex ) => {
        // Update family level selection State
        if( mapNodeAndSelectionState[ tempScope.families[ outerIndex ].familyStr ] !== undefined ) {
            tempScope.families[ outerIndex ].selectionState = mapNodeAndSelectionState[ tempScope.families[ outerIndex ].familyStr ];
        }
        // Update feature level selection State
        _.forEach( family.values, ( value, innerIndex ) => {
            let uid = value.optValue.uid;
            // Check if the UID is present in the map. If present, replace the old selection state by latest.
            if( mapNodeAndSelectionState[ uid ] !== undefined ) {
                // Update the selection state for the scope node UID.
                tempScope.families[ outerIndex ].values[ innerIndex ].selectionState = mapNodeAndSelectionState[ uid ];
            }
            if( tempScope.families[ outerIndex ].values[ innerIndex ].selectionState !== undefined ) {
                setIndicators( tempScope.families[ outerIndex ].values[ innerIndex ].selectionState, tempScope.families[ outerIndex ].values[ innerIndex ], true );
            }
        } );
    } );
    return tempScope;
};
/**
 * This API is called for Expand/Manual mode
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} data - The view data
 * @param {Object} fscState fscState atomic data
 * @returns {Object} - scope data
 */
export let getScopeDataForExpand = function( response, data, fscState ) {
    return exports.getScopeData( response, data.eventData.action, fscState );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * This API is called for Validate mode
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} fscState fscState atomic data
 * @returns {Object} - scope data
 */
export let getScopeDataForValidate = function( response, fscState ) {
    return exports.getScopeData( response, VCV_TOOLBAR_ACTIONS.VALIDATE, fscState );
};
/**
 * This API processes the cached server response and constructs Scope information
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} data - The view data
 * @param {Object} fscState fscState atomic data
 * @returns {Object} - scope data
 */
export let getScopeData = function( response, data, fscState ) {
    if( !fscState || !fscState.value ) {
        return;
    }
    let newState = { ...fscState.value };
    // Following toolbar actions allow empty variability tree data and VMO
    let VCV_SPECIFIC_TOOLBAR_ACTIONS = [ VCV_TOOLBAR_ACTIONS.EXPAND, VCV_TOOLBAR_ACTIONS.VALIDATE ];
    let action;
    if( typeof data === 'string' ) {
        action = VCV_SPECIFIC_TOOLBAR_ACTIONS.includes( data ) ? data : null;
    }
    var context = appCtxSvc.getCtx( 'fscContext' );
    var scopes;
    if( !_.isUndefined( response.responseInfo ) && !_.isEmpty( response.responseInfo.isValid ) &&
        response.responseInfo.isValid[ 0 ] === 'false' &&
        _.isEmpty( response.variabilityTreeData ) ) {
        // Leave UI untouched
        configuratorUtils.handleInvalidConfiguration( 'fscContext' );
        exports.showViolationsOnValidation( response.labels, response.responseInfo, response.payloadStrings );
        if( action ) {
            _scope = exports.updateSelectionStateAndSetIndicatorsOnExistingScopeData( configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions ), fscState );
        }
    } else {
        // Update UI
        if( _.isEmpty( response.variabilityTreeData ) ) {
            // if action is validate or expand, update the selectionState to latest.
            if( action ) {
                _scope = exports.updateSelectionStateAndSetIndicatorsOnExistingScopeData( configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions ), fscState );
            } else {
                _scope = null;
                exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().noVariabilityReasons, 'INFO' );
            }
        } else {
            scopes = configuratorUtils.populateScopes( response );
            _scope = null;
        }
        //select products/first group when switching to guided mode from unassigned group
        if( scopes && scopes.length > 0 && context.currentScope === pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID && context.guidedMode ) {
            context.currentScope = scopes[ 0 ].sourceUid;
            exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().switchingToGuidedFromUnassigned, 'INFO' );
        }
        for( var index in scopes ) {
            //Get the currently selected group
            if( scopes[ index ].sourceUid === context.currentScope ) {
                _scope = scopes[ index ];
                break;
            }
        }

        // if _scope is still null and scopes length is > 0 , then assign current scope and _scope to the first group received from populateScopes.
        if( scopes && scopes.length > 0 && _scope === null ) {
            _scope = scopes[ 0 ];
            context.currentScope = _scope.sourceUid;
        }

        context.payloadStrings = response.payloadStrings;
        context.selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions );
        if( response.selectedExpressions === undefined ) {
            context.selectedExpressions = {};
        }

        // Update info on context when configurations contains selections
        context.containsSelections = !exprGridSvc.expressionMapContainsNoUserSelection( context.selectedExpressions );

        if( context.guidedMode === undefined ) {
            context.guidedMode = true;
        }

        // Starting TC13.3, manage collapse/expand icon for families
        // --> enforce expanded state on all families
        // Check on scope is necessary in case previously selected scope was (pseudo) unassigned (not visible in guided)
        if( configuratorUtils.isPlatformVersionAtleast( 13, 3 ) && _scope !== null ) {
            _.forEach( _scope.families, family => { family.isCollapsed = false; } );
        }
        // Update the completeness status in summary
        if( !_.isUndefined( response.responseInfo ) && !_.isUndefined( response.responseInfo.criteriaStatus ) ) {
            // Update criteria status on context to enable/disable completeness navigation commands
            context.criteriaStatus = response.responseInfo.criteriaStatus[ 0 ];
            if( !newState.isSwitchingFromGridToListView ) {
                eventBus.publish( 'Pca0FullScreenSummary.updateCompletenessStatus', { CompletenessStatus: response.responseInfo.criteriaStatus[ 0 ] } );
            }
        }
    }

    // This method is called when
    // 1- a SVR is being loaded/removed
    // 2- a selection change happens in features list
    // 3- a scope is changed
    // 4- scopes are being reloaded after change in filter criteria
    // --> Configuration might be (or have become) invalid: take care of selections in summary in case of split (unsupported) or unconfigured.

    // Update Summary only for case 1) sending JSON information if a new SVR is loaded
    // When a SVR is being removed, summary has already been taken care of
    if( response.responseInfo && response.responseInfo.summaryOfSelections && response.variabilityTreeData.length !== 0 ) {
        eventBus.publish( 'Pca0FullScreenSummary.loadVariantData', response );
    }

    // Unsupported Split case: clear summary and selections
    if( response.responseInfo && response.responseInfo.isSplit && response.responseInfo.isSplit[ 0 ] === 'true' ) {
        eventBus.publish( 'Pca0FullScreenSummary.loadVariantData', {} );
    }

    // Review summary selections in case of unconfigured data if no SVR is being currently loaded right now.
    // In case of loading of SVR, summaryOfSelections is defined and already contains isUnconfigured flags.
    var handleUnconfiguredDataChanges = false;
    if( response.variabilityTreeData.length !== 0 ) {
        if( !_.isUndefined( response.responseInfo ) && !_.isEmpty( response.responseInfo.hasUnconfiguredData ) &&
            response.responseInfo.hasUnconfiguredData[ 0 ] === 'true' && _.isUndefined( response.responseInfo.summaryOfSelections ) ) {
            context.hasUnconfiguredData = true;
            handleUnconfiguredDataChanges = true;
        } else if( context.hasUnconfiguredData ) {
            // This happens when configuration has no longer unconfigured data: update summary tile icons
            context.hasUnconfiguredData = false;
            handleUnconfiguredDataChanges = true;
        }

        if( handleUnconfiguredDataChanges ) {
            eventBus.publish( 'Pca0FullScreenSummary.reviewConfiguredOptions', scopes );
        }
    }

    // Invalid configuration: show warning message and show violations on the success path if the response has invalid
    if( response.responseInfo && !_.isEmpty( response.responseInfo.isValid ) && response.responseInfo.isValid[ 0 ] === 'false' ) {
        // Switch the mode to manual if response is invalid and the suggested mode to open panel is guided.
        if( context.guidedMode === true ) {
            eventBus.publish( 'Pca0Features.stayInManualMode' );

            if( context.switchingToGuidedMode === undefined || context.switchingToGuidedMode === false ) {
                exports.showNotificationMessage( configuratorUtils.getFscLocaleTextBundle().switched_to_manual_mode, 'INFO' );
            }
        }
    }

    // Clear formula
    exprGridSvc.clearSelectedExpressionFormula( 'fscContext' );

    // Update Context information: reset switchingToGuided status
    delete context.switchingToGuidedMode;

    // Update Context information
    appCtxSvc.updateCtx( 'fscContext', context );
    return { group: _scope };
};

/**
 * This method returns the object containing meta information about the group
 * @param {object} response - The response received by SOA service
 * @param {Object} data - The view data
 * @returns {Object} - Returns the groupMeta for rendering
 */
export let getGroupMeta = function() {
    let groupMeta;
    if( _scope ) {
        groupMeta = _.omit( _scope, [ 'families' ] );
    }
    return groupMeta;
};

/**
 * This API updates the fsc value
 */
export const updateValue = ( data, newValue, path, familyComplete, isFamilySelection ) => {
    var group = data.scopeStruct.group;
    if( !isFamilySelection && path && group.families && group.families[ path.famIndex ] &&
        group.families[ path.famIndex ].values && group.families[ path.famIndex ].values[ path.index ] ) {
        if( !_.isUndefined( familyComplete ) && group.families[ path.famIndex ].complete !== familyComplete ) {
            let newGroup = { ...group };
            let fam = newGroup.families[ path.famIndex ];
            fam.values[ path.index ] = newValue;
            fam.complete = familyComplete;
            group = newGroup;
        } else {
            let fam = { ...group.families[ path.famIndex ] };
            fam.values[ path.index ] = newValue;
        }

        //also need to update the parallel scope for free form
        let familyObj = exports.getScopeFamilyObjectFromFamilyID( group.families[ path.famIndex ].familyStr );
        if( familyObj ) {
            familyObj.complete = familyComplete;
            if( path.index > -1 && familyObj.values[ path.index ] ) {
                familyObj.values[ path.index ] = newValue;
            }
        }
    }

    return { group: group };
};

/**
 * Update the family from command context with new set of values
 *  @param {*} grp - the scopeStruct group
 * @param {*} familyObject
 */
export let updateFamily = function( grp, familyObject ) {
    if( familyObject[ 'Pca0FeaturesService.updateFamily' ] ) {
        familyObject = familyObject[ 'Pca0FeaturesService.updateFamily' ]; //possible that the event obj is under 2 layers
    }
    if( familyObject.familyObj ) {
        familyObject = familyObject.familyObj;
    }
    var group = { ...grp };
    if( familyObject ) {
        let index = _.findIndex( group.families, function( family ) {
            return family.familyStr === familyObject.familyStr;
        } );
        if( index > -1 ) {
            group.families[ index ] = familyObject;
            _.find( _scope.families, function( family ) {
                if( family.familyStr === familyObject.familyStr ) {
                    family = familyObject;
                }
            } );
        }
    }
    return { group: group };
};

/**
 * This function removes the system or user selections from the current group

 *
 */
export let removeSelectionsFromCurrentGroup = function( context, selectionType ) {
    //If the group is the currently expanded group then iterate through its value selections and remove the system selections
    // This method is called also when entering FSC with a loaded SVR.
    // _scope might not have been rendered yet
    let tempScope = _.cloneDeep( _scope );
    if( !_.isNull( tempScope ) && !_.isEmpty( tempScope.families ) ) {
        //Iterate over the families of currently expanded group
        for( let family of tempScope.families ) {
            //removes the system selection indicator at family level
            if( ( selectionType === 'system' || selectionType === 'all' ) && configuratorUtils.getSystemSelectionStates().includes( family.selectionState ) ) {
                family.selectionState = 0;
            }
            //removes the user selections at family level
            if( ( selectionType === 'user' || selectionType === 'all' ) && !configuratorUtils.getSystemSelectionStates().includes( family.selectionState ) ) {
                family.selectionState = 0;
            }
            if( family.values ) {
                //Iterate over the values of currently expanded group
                for( let value of family.values ) {
                    //If the value is not available in user selection map then reset its selection state to 0
                    if( ( selectionType === 'system' || selectionType === 'all' ) && configuratorUtils.getSystemSelectionStates().includes( value.selectionState ) ) {
                        value.selectionState = 0;
                        // Remove the system selection indicator on the feature if any
                        if( value.optValue ) {
                            value.optValue.indicators = [];
                        }
                    }
                    if( ( selectionType === 'user' || selectionType === 'all' ) && !configuratorUtils.getSystemSelectionStates().includes( value.selectionState ) ) {
                        value.selectionState = 0;
                    }
                }
            }
        }
    }
    return tempScope;
};

/**
 * Post processing when user switches from guided to manual mode
 */
function manualModeSwitched() {
    //Close the package panel first
    eventBus.publish( 'Pca0FSCPackage.closePanel', {} );
    var eventData = {
        action: VCV_TOOLBAR_ACTIONS.SWITCHINGTOMANUAL
    };
    eventBus.publish( 'Pca0Features.Pca0Expand', eventData );
}

/**
 * This method handles the toggle btw guided and manual mode
 * @param {object} fscState - fscState atomic data
 * @param {Boolean} stayInManualMode - optional flag when invoked via events
 */
export let updateVariantMode = function( fscState, stayInManualMode ) {
    let context = null;
    context = appCtxSvc.getCtx( 'fscContext' );

    if( fscState && fscState.value ) {
        let newState = { ...fscState.value };
        if( newState.isManualConfiguration === true ) {
            //this means we are in manual configuration mode and we are switching to guided mode.
            context.switchingToGuidedMode = true;
            context.guidedMode = true;
            newState.isManualConfiguration = false;

            // Delete cached data on required Families
            delete context.incompleteFamiliesInfo;
            delete context.isNextRequiredClicked;
        } else {
            //this means we are in guided mode and we are switching to manual configuration mode.
            context.guidedMode = false;
            context.switchingToGuidedMode = false;
            newState.isManualConfiguration = true;
        }
        appCtxSvc.updateCtx( 'fscContext', context );
        if( fscState.update ) {
            fscState.update( newState );
        }

        if( newState.isManualConfiguration === true ) {
            //We do not want to reload the data when user switches from guided to manual mode
            if( !stayInManualMode ) {
                manualModeSwitched();
            }
        } else {
            eventBus.publish( 'Pca0Features.toggleManualGuidedMode' );
        }
        //eventBus.publish( 'Pca0Summary.variantModeUpdated' );
    }
};

/**
 * Displays the violation message if validation is invoked in manual mode.
 *
 * @param {ObjectArray} violationLabels - The violationLabels returned by SOA service which will be rendered on features
 * @param {Object} responseInfo - Additional information about response returned by SOA service
 * @param {String} payloadStrings -Map of <string,String[]> returned by SOA service
 *
 */
export let showViolationsOnValidation = function( violationLabels, responseInfo, payloadStrings ) {
    let currentGroup;
    var context = appCtxSvc.getCtx( 'fscContext' );
    currentGroup = context.currentScope;
    //Update the completeness status in summary
    if( responseInfo && responseInfo.criteriaStatus !== undefined ) {
        eventBus.publish( 'Pca0FullScreenSummary.updateCompletenessStatus', { CompletenessStatus: responseInfo.criteriaStatus[ 0 ] } );
    }
    if( currentGroup !== undefined ) {
        let summaryViolationsInfo = configuratorUtils.parseResponseAndExtractViolations( violationLabels, _scope );
        let validationErrorMessage = '';
        if( responseInfo !== undefined && responseInfo.validationErrorMessage !== undefined ) {
            validationErrorMessage = responseInfo.validationErrorMessage[ 0 ];
        }
        context.payloadStrings = payloadStrings;
        appCtxSvc.updateCtx( 'fscContext', context );
        eventBus.publish( 'awCustomVariantPanel.updateViolationIcon', {} );
        //  if( summaryViolationsInfo && summaryViolationsInfo !== null && summaryViolationsInfo[0].violationMessage !== undefined ) {
        eventBus.publish( 'Pca0Summary.updateViolationIcon', { summaryViolationsInfo, violationLabels, validationErrorMessage } );
        // }
    }
};

/**
 * Show notification message with message type.
 * @param {String} message notification message
 * @param {String} messageType type of message
 */
export let showNotificationMessage = function( message, messageType ) {
    return configuratorUtils.showNotificationMessage( message, messageType );
};
/**
 * getSelectionForVariantContext.
 * @param {String} context type of message
 */
export let getSelectionForVariantContext = function() {
    return configuratorUtils.getSelectionForVariantContext( 'fscContext' );
};
/**
 * Get configuration mode
 * @param {String} ctx context name
 */
export let getConfigurationMode = function() {
    return configuratorUtils.getConfigurationMode( 'fscContext' );
};

/**
 * Determines configuration mode
 * @param {Object} fscState fscState atomic data
 * @returns { String } In full screen configuration for platform >=12.4 default variant mode set to - Manual
 */
export let getConfigurationModeForLoadScopeData = function( fscState ) {
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    // If platform verson is 12.4 or later and a variant rule is applied then open that variant rule diretly in manual mode
    if( configuratorUtils.isPlatformVersionAtleast124() && getActiveVariantRules() !== null ) {
        fscContext.guidedMode = false;
        //fscContext.isManualConfiguration = true;
        appCtxSvc.updateCtx( 'fscContext', fscContext );
        //set the dirty state on fscState atomic data
        if( fscState && fscState.update ) {
            let newState = { ...fscState.value };
            // set the new state on the parent who is observing it and will be able to react
            newState.isManualConfiguration = true;
            fscState.update( newState );
        }
    }

    // If platform verson is 12.4 or later and a variant rule is applied then open that variant rule diretly in manual mode
    return getConfigurationMode();
};

/**
 * This API returns initialVariantRule only when selections are undefined
 * @param {Object} variantRuleData variant Rule Data
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function( variantRuleData ) {
    return configuratorUtils.getFscActiveVariantRules( variantRuleData );
};

/**
 * Return Profile Settings information
 */
export let getProfileSettings = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * Show ValidationErrorMessage
 * @param {String} data event data
 * @param {String} cntx context
 */
export let showValidationErrorMessage = function( data, cntx ) {
    return configuratorUtils.showValidationErrorMessage( data, cntx );
};
/**
 * stayInManualMode
 */
export let stayInManualMode = function() {
    eventBus.publish( 'Pca0Features.updateVariantMode', { stayInManualMode: true } );
};

/**
 * Displays the error message when switching to guided mode from manual is not allowed.
 *
 * @param {data} data
 *
 */
export let showUnableToSwitchToGuidedModeMessage = function( data ) {
    return configuratorUtils.showUnableToSwitchToGuidedModeMessage( data );
};

/**
 * This function removes the violations from the current group.
 *
 * @param {Object} context - The 'VariantConfigContext' object
 */
export let removeViolationsFromCurrentGroup = function() {
    let group = _.cloneDeep( _scope );
    //Itearate over the families of currently expanded group
    for( var j = 0; j < group.families.length; j++ ) {
        var family = group.families[ j ];
        if( family.values ) {
            //Iterate over the values of currently expanded group
            for( var k = 0; k < family.values.length; k++ ) {
                var value = family.values[ k ];
                //If the value has the violations then remove it
                delete value.violationsInfo;
                value.hasViolation = false;

                // Update "violation" indicator only
                // Do not change/remove existing "selectionState" and "unconfigured" indicators
                if( value.optValue ) {
                    _.remove( value.optValue.indicators, {
                        type: 'violation'
                    } );
                }
            }
        }
    }

    return group;
};

/**
 * Function invoked when validation is requested.
 * @param {Object} commandContext - context for validation command
 */
export let validateConfiguration = function( commandContext ) {
    _scope = exports.removeViolationsFromCurrentGroup();
    if( commandContext.fscState && commandContext.fscState.update ) {
        let newState = { ...commandContext.fscState.value };
        // set the new state on the parent who is observing it and will be able to react
        newState.isValidationInProgress = true;
        commandContext.fscState.update( newState );
    }
};

/**
 * Function invoked when when we click on expand command.
 */
export let expandSystemSelections = function() {
    _scope = exports.removeViolationsFromCurrentGroup();
    var eventData = {
        action: VCV_TOOLBAR_ACTIONS.EXPAND
    };
    eventBus.publish( 'Pca0Features.Pca0Expand', eventData );
};

/**
 * This API creates context for package and navigates to package command panel
 * @param {Object} packageCommandContext - Context for package command
 */
export let showPackagePanel = function( packageCommandContext ) {
    //Unregister the package context before opening the package panel
    appCtxSvc.unRegisterCtx( 'fscContext.packageContext' );

    var context = appCtxSvc.getCtx( 'fscContext' );
    //Take the backup of current selections before opening the package sub-panel
    var selectedExpressions = $.extend( true, {}, context.selectedExpressions );
    var payloadStrings = $.extend( true, [], context.payloadStrings );
    var configPerspective = { uid: packageCommandContext.configPerspectiveUid, type: 'Cfg0ConfiguratorPerspective' };
    var packageContext = {
        currentPackage: packageCommandContext.packageValue,
        packageFamily: packageCommandContext.packageFamily,
        selectedExpressions: selectedExpressions,
        payloadStrings: payloadStrings,
        configPerspective: configPerspective,
        guidedMode: true,
        showSavePackageCommand: false
    };
    context.packageContext = packageContext;
    appCtxSvc.updateCtx( 'fscContext', context );

    //Open the package panel
    commandPanelService.activateCommandPanel( 'Pca0FSCPackage', 'aw_toolsAndInfo' );
};

/**
 * Clear the middle Panel: do not show any features
 * @param {Object} data - The view data
 */
export let clearScopeData = function() {
    return [];
};

/**
 * Get the family Object in scope from familyID
 * @param {String} familyID Unique ID for family.
 * @returns { FamilyObject } The family Object in scope
 */
export let getScopeFamilyObjectFromFamilyID = function( familyID ) {
    return _.find( _scope.families, family => family.familyStr === familyID );
};

export let addInlineFreeFormFeature = function( commandContext ) {
    let familyObj = exports.getScopeFamilyObjectFromFamilyID( commandContext.family.familyStr );
    let feature = exports.createFreeFormFeature( familyObj );
    familyObj.values.push( feature );
    eventBus.publish( 'Pca0FeaturesService.freeFormFamilyChanged' );
};

export let removeInlineFreeFormFeature = function( commandContext ) {
    let familyObj = exports.getScopeFamilyObjectFromFamilyID( commandContext.family.familyStr );

    //let indx = familyObj.values.indexOf( commandContext.value );
    let indx = familyObj.values.map( function( val ) { return val.optValueStr; } ).indexOf( commandContext.value.optValueStr );
    if( indx > -1 ) {
        familyObj.values.splice( indx, 1 );
    }

    let selectionDataObj = {
        variantcontext: 'fscContext',
        valueaction: 'selectFeature',
        value: commandContext.value,
        family: familyObj,
        group: commandContext.group,
        state: 0,
        perspectiveUid: commandContext.configPerspectiveUid
    };

    let eventData = {
        selectionData: selectionDataObj,
        isFamilySelection: false
    };
    eventBus.publish( 'Pca0FscSelectionService.setSelection', eventData );
    eventBus.publish( 'Pca0FeaturesService.freeFormFamilyChanged' );
};

/**
 * resets the view data then fires an event to reload the data.
 * @param {Object} data - The view data
 */
export let resetGroup = function() {
    return {};
};

/**
 * Function invoked when when we confirmed to clear all system selections from across the all groups in fsc manual mode
 * @param {Object} fscState fscState atomic data
 */
export let clearSystemSelectionsInManualMode = function( fscState ) {
    var context = appCtxSvc.getCtx( 'fscContext' );
    clearSystemSelectionsFromSelectionsMap( fscState );
    _scope = exports.removeSelectionsFromCurrentGroup( context, 'system' );

    appCtxSvc.updateCtx( 'fscContext', context );
    return { group: _scope };
};

function clearSystemSelectionsFromSelectionsMap( fscState ) {
    var systemSelectionsFound = false;
    var context = appCtxSvc.getCtx( 'fscContext' );
    var localSelections = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );

    let selections = $.extend( true, [], localSelections );
    if( selections ) {
        // Iterate over the selections map
        for( let [ key, values ] of Object.entries( selections ) ) {
            if( values && Array.isArray( values ) ) {
                // Iterate over the selections for each family
                values.forEach( function( valueSelection ) {
                    // If selection is a system selection then remove it from the selections map
                    if( configuratorUtils.getSystemSelectionStates().includes( valueSelection.selectionState ) ) {
                        systemSelectionsFound = true;
                        var localvalues = localSelections[ key ];
                        var index = localvalues.indexOf( valueSelection );
                        localvalues.splice( index, 1 );
                        //If family contained only one selection then remove the family from the map
                        if( localvalues.length === 0 ) {
                            delete localSelections[ key ];
                        }
                    }
                } );
            }
        }
        // If system selections were found, mark configuration as dirty accordingly
        if( systemSelectionsFound ) {
            // Fire event of dirty configuration in case SVR is loaded
            // In case of:
            // 1- No Variant Rule loaded AND
            // 2- No changes in Settings (filterCriteria + profile) AND
            // 3- there are no selections left (in case user in manual mode de-selected all user selections)
            // THEN send "Configuration clean" event
            // Send "isDirty" event in all other cases

            var variantRulePanelDirty = true;

            if( !context.initialVariantRule && !context.settingsChanged && $.isEmptyObject( localSelections ) ) {
                variantRulePanelDirty = false;
            }
            //set the dirty state on fscState atomic data
            if( fscState && fscState.update ) {
                let newState = { ...fscState.value };
                // set the new state on the parent who is observing it and will be able to react
                newState.variantRuleDirty = variantRulePanelDirty;
                fscState.update( newState );
            }
        }
    }
}
/**
 * Function invoked when when we click on clear all selections command.
 */
export let clearAllSelectionsInFsc = function() {
    eventBus.publish( 'Pca0Features.clearAllSelectionsInFsc', {} );
};

/**
 * Function invoked when when we confirmed to clear all selections including user selections, system selections and reported violations
 * from across the all groups in guided or manual mode.
 * @param {Object} fscState fscState atomic data
 * */
export let clearAllSelections = function( fscState ) {
    var context = appCtxSvc.getCtx( 'fscContext' );
    delete context.payloadStrings;
    context.selectedExpressions = {};
    delete context.allSelectionsExt;

    _scope = exports.removeSelectionsFromCurrentGroup( context, 'all' );
    _scope = exports.removeViolationsFromCurrentGroup();

    // Delete cached data on required Families
    delete context.incompleteFamiliesInfo;
    delete context.isNextRequiredClicked;

    appCtxSvc.updateCtx( 'fscContext', context );

    if( context.guidedMode ) {
        //Fire an event to load the current goup in guided mode only
        eventBus.publish( 'Pca0Features.loadScopeData', {} );
    }

    var variantRulePanelDirty = false;
    if( context.initialVariantRule ) {
        variantRulePanelDirty = true;
    } else if( !context.settingsChanged ) {
        variantRulePanelDirty = false;
    }
    //set the dirty state on fscState atomic data
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        // set the new state on the parent who is observing it and will be able to react
        newState.variantRuleDirty = variantRulePanelDirty;
        fscState.update( newState );
    }

    return { group: _scope };
};

/**
 * Function invoked when when we click on clear all system selections  command in fsc manual mode.
 */
export let clearSystemSelectionsInFsc = function() {
    eventBus.publish( 'Pca0Features.clearSystemSelectionsInFsc', {} );
};

export let updateGroupListInScopeView = function( data ) {
    let eventData = {
        updatedGroupsList: data.updatedGroupsList
    };
    eventBus.publish( 'Pca0Scopes.updateGroups', eventData );
};

export let createFreeFormFeature = function( family, displayName = '', tmpValue = undefined ) {
    var augmentToExistingFeature = false;
    if( tmpValue ) {
        augmentToExistingFeature = true;
    } else {
        tmpValue = {};
    }
    if( !augmentToExistingFeature ) {
        tmpValue.isFiltered = true;
        tmpValue.selectionState = 0;
        var context = appCtxSvc.getCtx( 'fscContext' );
        if( context.guidedMode ) {
            tmpValue.allowedSelectionStates = [ 1, 0 ];
        } else {
            tmpValue.allowedSelectionStates = [ 1, 2, 0 ];
        }
    }
    var type = 'String';
    var familyType = family.familyType;
    tmpValue.optValueStr = family.familyStr + ':' + displayName;
    let vmo = {};
    if( familyType === 'Date' ) {
        type = 'DATE';
        tmpValue.dateApi = {
            isDateEnabled: true,
            dateObject: {}
        };
        let dateExpr = displayName.split( ' ' );
        if( dateExpr[ 1 ] ) {
            let fromOp = '';
            let toOp = '';
            let toDate = '';
            let fromDate = '';
            fromOp = dateExpr[ 0 ];
            fromDate = dateExpr[ 1 ];
            if( dateExpr[ 3 ] ) {
                toOp = dateExpr[ 3 ];
                toDate = dateExpr[ 4 ];
            }
            let formatedFromDate = commonUtils.getFormattedDateFromUTC( fromDate );
            let exprValue = fromOp + ' ' + formatedFromDate;
            if( dateExpr[ 3 ] && dateExpr[ 4 ] && toOp !== '' && toDate !== '' ) {
                let formatedToDate = commonUtils.getFormattedDateFromUTC( toDate );
                exprValue += ' & ' + toOp + ' ' + formatedToDate;
            }
            let typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION );
            //in case this is empty, add the default icon
            if( !typeIconURL ) {
                typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
            }
            vmo = {
                uid: '_freeFormFeature_',
                cellHeader1: exprValue,
                typeIconURL: typeIconURL,
                indicators: [],
                isDateRangeExpr: true
            };
            tmpValue.dateApi.dateValue = exprValue;
            tmpValue.uiValue = exprValue;
            tmpValue.isDateRangeExpr = true;
        } else {
            displayName = commonUtils.getFormattedDateFromUTC( displayName );
            tmpValue.dateApi.dateValue = displayName;
            tmpValue.dateApi.dateObject = dateTimeService.getJSDate( displayName );
            tmpValue.uiValue = displayName;
        }
    } else {
        tmpValue.validationCriteria = [ null ];
    }

    tmpValue.type = type;
    tmpValue.dbValue = displayName;
    tmpValue.dispValue = displayName;
    tmpValue.isRequired = false;
    tmpValue.isEditable = true;
    tmpValue.isEnabled = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isFreeFormFeature = true;
    tmpValue.optValue = vmo; // This is used for indicator labels like systemSelection etc

    return tmpValue;
};

/**
 * This API returns the Type of family for given VMO
 * @param {Object} familyVmo - family VMO
 * @param {String} familyVmo - type of family
 */
let getFamilyType = function( familyVmo ) {
    let familyType = 'String';
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Boolean' ) {
        familyType = 'Boolean';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Floating Point' ) {
        familyType = 'Floating Point';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Date' ) {
        familyType = 'Date';
    }
    if( familyVmo.props && familyVmo.props.cfg0ValueDataType && familyVmo.props.cfg0ValueDataType[ 0 ] === 'Integer' ) {
        familyType = 'Integer';
    }
    return familyType;
};

/**
 * Create a client side VMO for Unconfigured option values
 */
var createUnconfiguredClientSideVMO = function( tmpValue, familyUID ) {
    tmpValue.optValueStr = familyUID + ':' + tmpValue.valueDisplayName;
    tmpValue.isUnconfigured = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isUnconfiguredIndicatorTooltip = configuratorUtils.getFscLocaleTextBundle().isUnconfigured;

    var iconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_UNCONFIGURE_OBJ;
    var imageIconUrl = iconSvc.getTypeIconURL( iconName );
    tmpValue.optValue = {
        modelType: {
            // needed to set icon by controller aw-image-cell.controller from aw-option-value-cell
            constantsMap: {
                IconFileName: iconName
            }
        },
        objectID: tmpValue.valueDisplayName,
        uid: '_unconfiguredFeature_',
        name: tmpValue.valueDisplayName,
        cellHeader1: tmpValue.valueDisplayName,
        cellHeader2: tmpValue.valueDisplayName,
        typeIconURL: imageIconUrl,
        indicators: [],
        getId: function() {
            return this.uid;
        }
    };
};

/**
 *Helper to set the indicators on the value
 *
 * @param {Integer} state - state determining the indicators on vmo
 * @param {Object} tmpValue -Value object
 */
export var setIndicators = function( state, tmpValue, updateOnlySelectionStateIndicators = false ) {
    var selectionStateindicator = {};
    var indicators = [];
    var img;
    if( [ 9, 10 ].includes( state ) && tmpValue.isThumbnailDisplay ) {
        tmpValue.systemSelectionIndicatorTooltip = configuratorUtils.getCustomConfigurationLocaleTextBundle().systemSelectionTitle;
        img = 'indicatorSystemSelection';
        selectionStateindicator = {
            tooltip: tmpValue.systemSelectionIndicatorTooltip,
            image: img,
            type: 'selectionState'
        };
        indicators.push( selectionStateindicator );
    }
    if( [ 5, 6 ].includes( state ) && tmpValue.isThumbnailDisplay ) {
        tmpValue.defaultSelectionIndicatorTooltip = configuratorUtils.getCustomConfigurationLocaleTextBundle().defaultSelectionTitle;
        img = 'indicatorDefaultSelection';
        selectionStateindicator = {
            tooltip: tmpValue.defaultSelectionIndicatorTooltip,
            image: img,
            type: 'selectionState'
        };

        indicators.push( selectionStateindicator );
    }
    var unconfiguredIndicator = {};
    if( tmpValue.isUnconfigured && tmpValue.isThumbnailDisplay ) {
        img = 'indicatorConfiguredOut';
        unconfiguredIndicator = {
            tooltip: tmpValue.isUnconfiguredIndicatorTooltip,
            type: 'unconfigured',
            image: img
        };
        indicators.push( unconfiguredIndicator );
    }

    //this change was introduced in PLM739285 - questionable as it's in the main path
    // if( [ 0, 1, 2 ].includes( state ) ) {
    //     if( tmpValue.systemSelectionIndicatorTooltip ) {
    //         delete tmpValue.systemSelectionIndicatorTooltip;
    //     }
    //     if( tmpValue.defaultSelectionIndicatorTooltip ) {
    //         delete tmpValue.defaultSelectionIndicatorTooltip;
    //     }

    //     if( tmpValue.optValue ) {
    //         tmpValue.optValue.indicators = [];
    //     }
    // }

    //always check and reflect the violations as well
    if( tmpValue.hasViolation ) {
        var violationSeverity = tmpValue.violationsInfo.violationSeverity;
        if( violationSeverity === 'error' ) {
            img = 'indicatorError';
        } else if( violationSeverity === 'warning' ) {
            img = 'indicatorWarning';
        } else if( violationSeverity === 'info' ) {
            img = 'indicatorInfo';
        }
        if( !tmpValue.optValue ) {
            tmpValue.optValue = {
                uid: '_freeFormFeature_',
                cellHeader1: tmpValue.value.dbValue,
                typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE ),
                indicators: []
            };
        }
        indicators.push( {
            type: 'violation',
            tooltip: tmpValue.violationsInfo.violationMessage,
            image: img
        } );
    }
    //make sure not to take duplicates in if you merge from the tmpValue
    if( tmpValue.optValue ) {
        let images = tmpValue.optValue.indicators ? new Set( tmpValue.optValue.indicators.map( i => i.image ) ) : [];
        let merged = tmpValue.optValue.indicators ? [ ...tmpValue.optValue.indicators, ...indicators.filter( i => !images.has( i.image ) ) ] : [];
        tmpValue.optValue.indicators = tmpValue.optValue.indicators ? merged : indicators;
    }
};

/**
 *This API creates the Feature node structure

 * @param {ObjectArray} valueNode - variability data
 * @param {Object} vmos - view model objects
 * @param {boolean} isFreeForm for freeForm family
 * @param {Object} family - family object
 * @param {Object} labels - labels
 * @param {Object} wsObjects - wsObjects
 * @param {Object} familyVmo - familyVmo
 * @returns {Object} Feature node
 */
function createFeatureNode( valueNode, vmos, isFreeForm, family, labels, wsObjects, familyVmo ) {
    let tmpValue = {};
    let valueVmo = vmos[ valueNode.nodeUid ];
    tmpValue.valueDisplayName = valueVmo.displayName;
    tmpValue.isFiltered = true;
    // Note: isProductModelFamily was part of featureObject.props when FullScreenConfigurationService was used in AW server
    tmpValue.isProductModelFamily = family.isProductModelFamily;
    let state = undefined;
    let unconfigured = false;
    if( valueNode.props ) {
        state = Number( valueNode.props.selectionState[ 0 ] );
        tmpValue.selectionState = state;
        if( valueNode.props.allowedSelectionStates ) {
            tmpValue.allowedSelectionStates = valueNode.props.allowedSelectionStates.map( Number );
        }
    }
    if( valueNode.props && valueNode.props.isPackage ) {
        tmpValue.isPackage = valueNode.props.isPackage[ 0 ] === 'true'; //todo
    }
    if( valueVmo.props && valueVmo.props.isThumbnailDisplay ) {
        tmpValue.isThumbnailDisplay = valueVmo.props.isThumbnailDisplay[ 0 ] === 'true';
    }
    let violationsInfo = configuratorUtils.buildViolationString( valueNode.nodeUid, labels );
    if( violationsInfo !== null && violationsInfo.violationMessage !== undefined ) {
        tmpValue.violationsInfo = violationsInfo;
        tmpValue.hasViolation = true;
    } else {
        tmpValue.hasViolation = false;
    }
    let wsObject = undefined;
    if( wsObjects ) {
        wsObject = wsObjects[ valueNode.nodeUid ];
    }
    if( wsObject !== undefined ) {
        tmpValue.optValue = viewModelObjectService.createViewModelObject( wsObject );
        //if not yet set default to thumbnails
        if( _.isUndefined( tmpValue.isThumbnailDisplay ) ) {
            tmpValue.isThumbnailDisplay = true;
        }
    }

    tmpValue.optValueStr = valueNode.nodeUid;

    if( valueNode.props && valueNode.props.isEnumeratedRangeExpressionSelection &&
        valueNode.props.isEnumeratedRangeExpressionSelection[ 0 ] ) {
        tmpValue.isEnumeratedRangeExpr = true;
    }
    if( isFreeForm ) {
        tmpValue = exports.createFreeFormFeature( family, valueVmo.displayName, tmpValue );
    } else if( tmpValue.isEnumeratedRangeExpr ) {
        const ids = familyVmo.props.cfg0ChildrenIDs;
        const displayValues = familyVmo.props.cfg0ChildrenDisplayNames;
        tmpValue = createEnumerateRangeExpFeature( family, valueVmo.displayName, tmpValue.selectionState, ids, displayValues );
    } else if( valueNode.props && valueNode.props.isUnconfigured && valueNode.props.isUnconfigured[ 0 ] === 'true' ) {
        // Check if feature is configured out in current configuration
        // Create a client-side VMO
        createUnconfiguredClientSideVMO( tmpValue, family.familyStr );
        unconfigured = true;
    }

    if( family.familyType === 'Date' && !isFreeForm &&
        !tmpValue.isEnumeratedRangeExpr && !unconfigured ) {
        // Enumerated family only with default values of dates with object_String
        const dateToFormat = tmpValue.valueDisplayName;
        tmpValue.valueDisplayName = enumFeature.getDisplayNamesForEnumeratedFeature( dateToFormat, familyVmo.props.cfg0ChildrenIDs, familyVmo.props.cfg0ChildrenDisplayNames );
        tmpValue.optValue.cellHeader1 = tmpValue.valueDisplayName;
    }
    //set the right indicators based on state
    setIndicators( state, tmpValue );

    return tmpValue;
}

/**
 * Returns option values for a family
 *
 * @param {ObjectArray} optionValues value uids
 * @param {ObjectArray} treeData - variability data
 * @param {Object} vmos - view model objects
 * @param {boolean} isFreeForm for freeForm family
 * @param {Object} family - family object
 * @param {Object} labels - labels
 * @param {Object} wsObjects - wsObjects
 * @param {Object} familyVmo - familyVmo
 * @returns {ObjectArray} The array of features for option family
 */
function getFeaturesForFamily( optionValues, treeData, vmos, isFreeForm, family, labels, wsObjects, familyVmo ) {
    let tmpValues = [];
    _.forEach( optionValues, id => {
        let valueNode = treeData[ id ];
        //check for parent property
        if( valueNode ) {
            tmpValues.push( createFeatureNode( valueNode, vmos, isFreeForm, family, labels, wsObjects, familyVmo ) );
        }
    } );
    return tmpValues;
}

/**
 *This API creates the Family node structure
 *
 * @param {ObjectArray} treeData - variability data
 * @param {Object} vmos - view model objects
 * @param {string} id - id
 * @param {Object} wsObjects - wsObjects
 * @param {Object} labels - labels
 * @returns {Object} family node
 */
let createFamilyNode = function( treeData, vmos, id, wsObjects, labels ) {
    let tmpFamily = {};
    let familyNode = treeData[ id ];
    let familyVmo = vmos[ familyNode.nodeUid ];
    let familyID = familyNode.nodeUid;

    tmpFamily.familyDisplayName = familyVmo.displayName;
    tmpFamily.familyStr = familyID;
    if( familyNode.props && familyNode.props.selectionState ) {
        tmpFamily.selectionState = Number( familyNode.props.selectionState[ 0 ] );
    }
    tmpFamily.familyType = getFamilyType( familyVmo );
    if( tmpFamily.familyType === undefined ) {
        tmpFamily.familyType = familyVmo.sourceType;
    }
    if( familyNode.props && familyNode.props.isComplete ) {
        tmpFamily.complete = familyNode.props.isComplete[ 0 ] === 'true';
    }
    if( familyNode.props && familyNode.props.isUnconfigured ) {
        tmpFamily.isUnconfigured = familyNode.props.isUnconfigured[ 0 ] === 'true';
    }
    tmpFamily.isFiltered = true;
    if( familyNode.props && familyNode.props.allowedSelectionStates ) {
        tmpFamily.allowedSelectionStates = Number( familyNode.props.allowedSelectionStates.map( Number ) );
    }
    if( familyNode.props && familyNode.props.selectionState ) {
        tmpFamily.selectionState = Number( familyNode.props.selectionState[ 0 ] );
    }
    if( familyVmo.props && familyVmo.props.isProductModelFamily ) {
        tmpFamily.isProductModelFamily = familyVmo.props.isProductModelFamily[ 0 ] === 'true';
    }
    if( familyVmo.props && familyVmo.props.isThumbnailDisplay ) {
        tmpFamily.isThumbnailDisplay = familyVmo.props.isThumbnailDisplay[ 0 ] === 'true';
    }
    let isFreeForm = false;
    if( familyVmo.props && familyVmo.props.isFreeForm ) {
        isFreeForm = familyVmo.props.isFreeForm[ 0 ] === 'true';
    }
    tmpFamily.isFreeForm = isFreeForm;
    let features = familyNode.childrenUids;
    if( features && features.length > 0 ) {
        tmpFamily.values = getFeaturesForFamily( features, treeData, vmos, isFreeForm, tmpFamily, labels, wsObjects, familyVmo );
    } else if( isFreeForm ) {
        tmpFamily.values = [ exports.createFreeFormFeature( tmpFamily, undefined ) ];
    }

    if( familyVmo.props ) {
        //Show range information
        let rangeInfo = familyVmo.props.rangeInfo;
        if( rangeInfo && rangeInfo.length > 0 ) {
            tmpFamily.allowedRange = rangeInfo[ 0 ];
        }
        if( familyVmo.props.isSingleSelect ) {
            tmpFamily.singleSelect = familyVmo.props.isSingleSelect[ 0 ] === 'true';
        }
        if( familyVmo.props.cfg0IsDiscretionary ) {
            tmpFamily.cfg0IsDiscretionary = familyVmo.props.cfg0IsDiscretionary[ 0 ] === 'true';
        }
        if( familyVmo.props.cfg0ChildrenDisplayNames && familyVmo.props.cfg0ChildrenIDs ) {
            tmpFamily.childrenDispValues = familyVmo.props.cfg0ChildrenDisplayNames;
            tmpFamily.cfg0ChildrenIDs = familyVmo.props.cfg0ChildrenIDs;
        }
    }
    tmpFamily.incompleteIndicatorLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().incompleteIndicatorLabel;

    return tmpFamily;
};

/**
 * Returns option families for a group *
 *
 * @param {ObjectArray} families - option families uids
 * @param {ObjectArray} treeData - variability data .
 * @param {Object} vmos - view model objects
 * @param {Object} wsObjects - wsObjects
 *
 * @returns {ObjectArray} The array of option families for option group
 */
function getFamiliesForGroup( families, treeData, vmos, wsObjects, labels ) {
    let tempFamilies = [];
    _.forEach( families, id => {
        tempFamilies.push( createFamilyNode( treeData, vmos, id, wsObjects, labels ) );
    } );

    return tempFamilies;
}

/**
 *  Create group nodes from treeData
 *
 * @param {ObjectArray} treeData - variability data .
 * @param {Object} vmos - view model objects
 * @param {Object} wsObjects - wsObjects
 * @param {Object} labels - wsObjects
 * @returns {Object} Group node
 */
export let createGroupsNode = function( treeData, vmos, id, wsObjects, labels ) {
    let tmpScope = {};
    let groupNode = treeData[ id ];
    let groupVmo = vmos[ groupNode.nodeUid ];

    tmpScope.optGroup = groupNode.nodeUid;
    tmpScope.groupDisplayName = groupVmo.displayName;
    tmpScope.sourceUid = groupVmo.sourceUid;
    let wsObject = undefined;
    if( wsObjects ) {
        wsObject = wsObjects[ tmpScope.sourceUid ];
    }
    if( wsObject && wsObject !== undefined ) {
        tmpScope.vmo = viewModelObjectService.createViewModelObject( wsObject );
        tmpScope.isThumbnailDisplay = true;
    }
    if( groupNode.childrenUids && groupNode.childrenUids.length > 0 ) {
        // Case: Open panel- show OR
        // Case: There are valid values for a group OR
        // Case: There are no valid values in the expanded group
        tmpScope.expand = true;
    } else {
        tmpScope.expand = false;
    }
    let totalFeatureCount = 0;
    if( groupNode.childrenUids && groupNode.childrenUids.length > 0 ) {
        tmpScope.families = getFamiliesForGroup( groupNode.childrenUids, treeData, vmos, wsObjects, labels );
        for( var inx = 0; inx < tmpScope.families.length; inx++ ) {
            if( tmpScope.families[ inx ].values ) {
                totalFeatureCount += tmpScope.families[ inx ].values.length;
            }
        }
    }
    if( totalFeatureCount > 15 ) {
        tmpScope.showFilter = true;
    }
    return tmpScope;
};

var matchValuesToFilterText = function( family, patt ) {
    // If family is not filtered then check values.
    // If any of the value is filtered then family is filtered
    var valueMatch = false;
    for( var v_inx = 0; v_inx < family.values.length; v_inx++ ) {
        var value = family.values[ v_inx ];
        var isMatch = false;
        if( value.optValue && value.optValue.cellHeader1 ) {
            // Tiles are displayed for these values
            isMatch = matchValuesInTiles( value, patt );
        } else {
            // Values are displayed as string
            isMatch = patt.test( value.valueDisplayName );
        }
        value.isFiltered = isMatch;
        if( value.isFiltered && valueMatch === false ) {
            valueMatch = true;
        }
    }

    family.isFiltered = valueMatch;
};

var matchValuesInTiles = function( value, patt ) {
    // When Values are displayed as tiles match the pattern with cellheaders and cell properties
    var isMatch = patt.test( value.optValue.cellHeader1 );
    if( !isMatch && value.optValue.cellHeader2 ) {
        isMatch = patt.test( value.optValue.cellHeader2 );
    }

    if( !isMatch && value.optValue.cellProperties ) {
        for( var index = 0; index < value.optValue.cellProperties.length; index++ ) {
            isMatch = patt.test( value.optValue.cellProperties[ index ].value );
            if( isMatch ) {
                break;
            }
        }
    }
    return isMatch;
};

export let filterFeatures = function( data ) {
    var inputFilterText = data.filterText.dbValue;
    var tempGroup = data.scopeStruct.group;
    if( inputFilterText ) {
        let filterText = inputFilterText;
        // Usage of Kleene Star is different from what we normally intend in file/directory patterns
        // The character * in a regular expression means "match the preceding character zero or many times"
        // e.g. 'ba*' matches b, ba, baa, baaa, baaaa, ...
        // By default, filterData.filterText is the string searched in the family/value displayName
        // Wildcard * used in this search should be preceded by . (dot)
        // to get same value as when searching for file names/paths
        filterText = filterText.replace( '*', '.*' );
        //ctx.filterData.filterText = filterText;
        var patt = new RegExp( filterText, 'i' );

        var arrayLength = data.scopeStruct.group.families.length;
        tempGroup = _.cloneDeep( data.scopeStruct.group );
        for( var inx = 0; inx < arrayLength; inx++ ) {
            var family = tempGroup.families[ inx ];

            // Check for boolean
            if( family.familyDisplayName ) {
                family.isFiltered = patt.test( family.familyDisplayName );
            } else {
                family.isFiltered = false;
            }

            // If family is filtered then all values are filtered
            if( family.isFiltered ) {
                for( var i = 0; i < family.values.length; i++ ) {
                    family.values[ i ].isFiltered = true;
                }
            } else {
                matchValuesToFilterText( family, patt );
            }
        }
    }
    return tempGroup;
};

/**
 * Add free form range expression option value in VCV
 * @param {Object} data - eventData
 * @param {Object} fscState - fscState
 */
export let addFreeFormOptionValue = function( eventData, fscState ) {
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let familyStr = commandContext.family.familyStr;
    let prevValueUid = familyStr + ':' + commandContext.value.dbValue;

    // If user loads SVR which has date and try to update date value.
    if( commandContext.value.type === 'DATE' && !prevValueUid.endsWith( 'T00:00:00Z' ) && commandContext.value.valueDisplayName ) {
        prevValueUid = familyStr + ':' + commandContext.value.valueDisplayName;
    }

    let finalValue = eventData.valueText;
    // Replace old option value selection with new
    if( commandContext.value.dbValue !== eventData.valueText && !_.isEmpty( fscContext.selectedExpressions ) ) {
        let optionValueSelections = [];
        let configExprMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );
        if( configExprMap && familyStr in configExprMap &&
            configExprMap[ familyStr ] !== undefined ) {
            optionValueSelections = configExprMap[ familyStr ];
        }
        let indexToRemove = null;
        for( let i = 0; i < optionValueSelections.length; i++ ) {
            let tmpUid = optionValueSelections[ i ].family + ':' + optionValueSelections[ i ].valueText;
            if( tmpUid === prevValueUid ) {
                indexToRemove = i;
                break;
            }
        }
        if( indexToRemove !== null && indexToRemove > -1 ) {
            optionValueSelections.splice( indexToRemove, 1 );
        }
        if( configExprMap && configExprMap[ familyStr ] ) {
            configExprMap[ familyStr ] = optionValueSelections;
        }
    }

    //new free form option value
    // commandContext.value.dbValue = finalValue;
    commandContext.value.selectionState = 1;
    // commandContext.value.optValueStr = familyStr + ':' + finalValue;
    let displayValue = finalValue;
    let vmo = {
        uid: '_freeFormFeature_',
        cellHeader1: displayValue,
        typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION ),
        indicators: [],
        isDateRangeExpr: false
    };
    //in case this is empty, add the default icon
    if( !vmo.typeIconURL ) {
        vmo.typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    }

    let dateExpr = finalValue.split( ' ' );
    //To display formated date
    if( commandContext.value.isFreeFormFeature && commandContext.value.type === 'DATE' && !commandContext.value.error && dateExpr[ 1 ] ) {
        let fromOp = '';
        let toOp = '';
        let toDate = '';
        let fromDate = '';
        if( dateExpr[ 1 ] ) {
            fromOp = dateExpr[ 0 ];
            fromDate = dateExpr[ 1 ];
        }
        if( dateExpr[ 3 ] ) {
            toOp = dateExpr[ 3 ];
            toDate = dateExpr[ 4 ];
        }
        let formatedFromDate = commonUtils.getFormattedDateFromUTC( fromDate );
        let formatedToDate = commonUtils.getFormattedDateFromUTC( toDate );
        let exprValue = fromOp + ' ' + formatedFromDate;

        // date value for TC DB should in UTC format
        finalValue = fromOp + ' ' + commonUtils.getFormattedDateString( new Date( fromDate ) );
        if( dateExpr[ 3 ] && dateExpr[ 4 ] ) {
            exprValue += ' & ' + toOp + ' ' + formatedToDate;
            finalValue += ' & ' + toOp + ' ' + commonUtils.getFormattedDateString( new Date( toDate ) );
        }

        displayValue = exprValue;
        const dateApi = {
            isDateEnabled: true,
            dateObject: {},
            dateValue: exprValue
        };
        commandContext.value.dateApi = dateApi;
        vmo.isDateRangeExpr = true;
        commandContext.value.isDateRangeExpr = true;
    }
    vmo.cellHeader1 = displayValue;
    commandContext.value.optValueStr = familyStr + ':' + finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.optValue = vmo;
    commandContext.value.uiValue = displayValue;
    commandContext.value.uiOriginalValue = displayValue;
    setSelectionInSummary( commandContext, 1 );

    //set the dirty state on fscState atomic data in order to trigger update; 
    //will not be needed if we move the entire group struct to atomic data

    let newState = { ...fscState.getValue() };
    newState.variantRuleDirty = true;
    fscState.update( newState );

    return commandContext;
};

/**
 * Give the request info according to the action
 * @param {Object} data - The view data
 * @returns {Object} requestInfo
 */
export let getRequestInfoForExpandSystemSelection = function( data ) {
    let requestInfo = {
        requestType: [ VCV_TOOLBAR_ACTIONS.EXPAND ],
        configurationControlMode: [ configuratorUtils.getConfigurationMode( 'fscContext' ) ],
        profileSettings: [ configuratorUtils.getProfileSettingsForFsc() ]
    };
    Object.assign( requestInfo, data.eventData.action === 'switchingToManual' ? { switchingToManualMode: [ 'true' ] } : null );
    return requestInfo;
};

export let getRequestInfoForToggleManualGuidedMode = function() {
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    let requestInfo = {
        requestType: [ 'getConfig' ],
        configurationControlMode: [ configuratorUtils.getConfigurationMode( 'fscContext' ) ],
        switchingToGuidedMode: [ fscContext.switchingToGuidedMode ? 'true' : '' ],
        profileSettings: [ configuratorUtils.getProfileSettingsForFsc() ]
    };
    Object.assign( requestInfo, fscContext.reassessSelections ? { reassessSelections: [ 'true' ] } : null );
    delete fscContext.reassessSelections;

    appCtxSvc.updateCtx( 'fscContext', fscContext );
    return requestInfo;
};

/**
 * Helps to create Feature for enumerated family
 * @param {Object} family To get information about family to create respective feature
 * @param {String} displayName Name to display on Feature
 * @param {number} selectionState Set selection state
 * @param {string[]} ids names identified by server
 * @param {string[]} displayValues UI values to show on AW with respective to server
 * @returns {Object} tmpValue To updates data in AW
 */
let createEnumerateRangeExpFeature = function( family, displayName = '', selectionState = 1, ids, displayValues ) {
    let tmpValue = {};
    let type = 'String';
    let familyType = family.familyType;
    /**
     * We have introduced cfg0ChildrenIDs and cfg0displayValues array at server
     * cfg0displayValues contains display required by end user with respective to cfg0ChildrenIDs
     * e.g. for integer datatype
     * cfg0ChildrenIDs = [1, 2, 3]  // These are acutual values know by server
     * cfg0displayValues = [ 'one', 'two', 'three' ] // values expected by user at AW display
     * so following function help us to get respective display values for there ids.
     */
    displayName = enumFeature.getDisplayNamesForEnumeratedFeature( displayName, ids, displayValues );
    let vmo = {
        uid: '_freeFormFeature_',
        cellHeader1: displayName,
        typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION ),
        indicators: [],
        isDateRangeExpr: false
    };
    //in case this is empty, add the default icon
    if( !vmo.typeIconURL ) {
        vmo.typeIconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    }
    if( familyType === 'Date' ) {
        tmpValue.uiValue = displayName;
        vmo.isDateRangeExpr = true;
    }
    tmpValue.optValueStr = family.familyStr + ':' + displayName;
    tmpValue.allowedSelectionStates = [ 1, 2, 0 ];
    tmpValue.isFiltered = true;
    tmpValue.selectionState = selectionState;
    tmpValue.type = type;
    tmpValue.dbValue = displayName;
    tmpValue.dispValue = displayName;
    tmpValue.isRequired = false;
    tmpValue.isEditable = true;
    tmpValue.isEnabled = true;
    tmpValue.isThumbnailDisplay = true;
    tmpValue.isFreeFormFeature = false;
    tmpValue.isEnumeratedRangeExpr = true;
    tmpValue.optValue = vmo;

    return tmpValue;
};

/**
 * Helps to remove already selected feature from Expression Map
 * @param {String} familyUid To get feature belongs specific family
 * @param {String} prevFeatureUid To compare and remove from selected range feature
 * @param {String} previousValue To compare with current display
 * @param {String} currentValue To compare with previous value
 * @param {String} selectedExpression To get expression from expression map
 * @param {Object} commandContext panel context
 * @returns {Object} updated family object
 */
let removePreviousValueForSelectedRange = function( familyUid, prevFeatureUid, previousValue, currentValue, selectedExpression, commandContext ) {
    //let previousSelectionRemoved = false;
    let familyObj = exports.getScopeFamilyObjectFromFamilyID( commandContext.family.familyStr );
    //Replace old option value selection with new
    if( previousValue && previousValue !== currentValue && !_.isEmpty( selectedExpression ) ) {
        let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
        let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
        /**
         * We have introduced cfg0ChildrenIDs and cfg0displayValues array at server
         * cfg0displayValues contains display required by end user with respective to cfg0ChildrenIDs
         * e.g. for integer datatype
         * cfg0ChildrenIDs = [1, 2, 3]  // These are acutual values know by server
         * cfg0displayValues = [ 'one', 'two', 'three' ] // values expected by user at AW display
         * so following function help us to get ids values for selected display name as we store expression using ids in config expression map.
         */
        prevFeatureUid = enumFeature.getServerNamesForEnumeratedFeature( prevFeatureUid, ids, displayValues );
        let availableRangeFeatures = [];
        let configExprMap = exprGridSvc.getConfigExpressionMap( selectedExpression );
        if( configExprMap && familyUid in configExprMap &&
            configExprMap[ familyUid ] !== undefined ) {
            availableRangeFeatures = configExprMap[ familyUid ];
        }
        let indexToRemove = null;
        for( let i = 0; i < availableRangeFeatures.length; i++ ) {
            let tmpUid = availableRangeFeatures[ i ].family + ':' + availableRangeFeatures[ i ].valueText;
            if( tmpUid === prevFeatureUid ) {
                indexToRemove = i;
                //previousSelectionRemoved = true;
                break;
            }
        }
        if( indexToRemove !== null && indexToRemove > -1 ) {
            availableRangeFeatures.splice( indexToRemove, 1 );
        }
        configExprMap[ familyUid ] = availableRangeFeatures;
    }
    return familyObj;
};

/**
 * Helps to show selection in Summary page/view
 * @param {Object} commandContext To get information about selected feature
 * @param {number} select To set selection in summay page by default its 1
 */
let setSelectionInSummary = function( commandContext, select = 1 ) {
    let selectionDataObj = {
        variantcontext: 'fscContext',
        valueaction: 'selectFeature',
        value: commandContext.value,
        family: commandContext.family,
        group: commandContext.group,
        state: select,
        perspectiveUid: commandContext.configPerspectiveUid
    };
    let selectionObj = {
        selectionData: selectionDataObj,
        isFamilySelection: false
    };
    eventBus.publish( 'Pca0FscSelectionService.setSelection', selectionObj );
};

/**
 * To remove selction from summary and family object.
 * @param {Object} commandContext panel context
 * @returns {Object} commandContext
 */
export let removeRangeExpForEnumeratedFeature = function( commandContext ) {
    let familyObj = exports.getScopeFamilyObjectFromFamilyID( commandContext.family.familyStr );
    var indx = _.findIndex( familyObj.values, function( val ) {
        return val.optValueStr === commandContext.value.optValueStr && val.dbValue === commandContext.value.dbValue;
    } );
    if( indx > -1 ) {
        familyObj.values.splice( indx, 1 );
    }
    eventBus.publish( 'Pca0FeaturesService.updateFamily', familyObj );
    commandContext.family = familyObj;
    setSelectionInSummary( commandContext, 0 );
    return {
        commandContext: commandContext
    };
};

/**
 * updates range feature to enumerated family and Create thumbnail vmo
 * @param {Object} data : view model json input
 * @returns {Object} commandContext
 */
export let updateRangeExpressionForEnumeratedFamily = function( data ) {
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let finalValue = data.eventData.valueText;
    let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
    let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
    commandContext.value.optValueStr = commandContext.family.familyStr + ':' + finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.dispValue = finalValue;
    let featureData = createEnumerateRangeExpFeature( commandContext.family, finalValue, 1, ids, displayValues );
    commandContext.value.optValue = featureData.optValue;
    commandContext.value.selectionState = 1;
    commandContext.value.isThumbnailDisplay = true;
    commandContext.group.groupDisplayName = data.scopeStruct.group.groupDisplayName;
    commandContext.group.groupUID = data.scopeStruct.group.groupUID;
    let familyStr = commandContext.family.familyStr;
    let prevFeatureUid = familyStr + ':' + data.eventData.oldValueText;
    removePreviousValueForSelectedRange( familyStr, prevFeatureUid, data.eventData.oldValueText, finalValue, fscContext.selectedExpressions, commandContext );

    setSelectionInSummary( commandContext );
    return commandContext;
};

/**
 * Add range feature to enumerated family and Create thumbnail vmo
 * @param {Object} data : view model json input
 * @returns {Object} commandContext
 */
export let addRangeExpressionForEnumeratedFamily = function( data ) {
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    let commandContext = fscContext.isFreeFormCtx.commandContext;
    let ids = commandContext.cfg0ChildrenIDs ? commandContext.cfg0ChildrenIDs : commandContext.family.cfg0ChildrenIDs;
    let displayValues = commandContext.childrenDispValues ? commandContext.childrenDispValues : commandContext.family.childrenDispValues;
    let finalValue = data.eventData.valueText;
    let featureData = createEnumerateRangeExpFeature( commandContext.family, finalValue, 1, ids, displayValues );
    let familyObj = exports.getScopeFamilyObjectFromFamilyID( commandContext.family.familyStr );

    commandContext.value.optValueStr = commandContext.family.familyStr + ':' + finalValue;
    commandContext.value.valueDisplayName = finalValue;
    commandContext.value.dbValue = finalValue;
    commandContext.value.dispValue = finalValue;
    commandContext.value.selectionState = 1;
    commandContext.value.optValue = featureData.optValue;
    commandContext.value.isThumbnailDisplay = true;
    commandContext.value.isEnumeratedRangeExpr = featureData.isEnumeratedRangeExpr;
    commandContext.group.groupDisplayName = data.scopeStruct.group.groupDisplayName;
    commandContext.group.groupUID = data.scopeStruct.group.groupUID;
    familyObj.values.push( featureData );
    commandContext.family = familyObj;
    setSelectionInSummary( commandContext );
    return commandContext;
};

/**
 * Returns the switchingToGuidedMode flag
 * @returns {string} - flag
 */
export let getSwitchingToGuidedMode = function() {
    var context = appCtxSvc.getCtx( 'fscContext' );
    if( context && context.switchingToGuidedMode ) {
        return 'true';
    }
    return 'false';
};

/**
 * Listener to condition value change for families collection
 * Focus on active family
 * Scroll to active family (e.f. family owning last selected feature)
 *
 * If Guided Navigation is active
 * Collapse other families in group and keep expanded navigation target family only.

 * Update Navigation information on context
 * @param {Object} group The scope
 * @param {Object} elementRefList - elementRefList from mounted component
 */
export let focusToFamily = function( group, elementRefList ) {
    let fscContext = appCtxSvc.getCtx( 'fscContext' );

    var scope = { ...group };

    // Event listener to condition value change to the whole collection of families
    // Need to move along if we are in the right scope and families are loaded for the scope
    if( !_.isUndefined( fscContext.navigateTo ) && fscContext.navigateTo.groupUid === scope.sourceUid ) {
        // Collapse all other families
        _.forEach( scope.families, family => {
            family.isCollapsed = family.familyStr !== fscContext.navigateTo.familyUid;
            family.isHighlighted = family.familyStr === fscContext.navigateTo.familyUid;

            // Un-comment this code when multi-select families scenario is addressed.
            // // If multi-select family, its required features will display an *
            // if( family.isHighlighted && !family.singleSelect ) {
            //     let cachedTreeNodes = fscContext.incompleteFamiliesInfo.incompleteFamiliesTreeData;
            //     _.forEach( family.values, feature => {
            //         let featureNode = _.find( cachedTreeNodes, { nodeUid: feature.optValueStr } );
            //         feature.isRequiredForCompletenessCheck = !_.isUndefined( featureNode );
            //     } );
            // }
        } );

        // Save current navigation point (it will be used for further navigation)
        fscContext.activeFamilyUID = fscContext.navigateTo.familyUid;

        // Update Context information
        appCtxSvc.updateCtx( 'fscContext', fscContext );
    }

    return {
        group: scope,
        focusedFamilyId: fscContext.activeFamilyUID
    };
};

/**
 * SummarySelection component updated - scroll into view the added element
 * @param {string} focusedFamilyId - focused family
 * @param {Object} elementRefList - elementRefList from mounted component
 * */
export let pca0FeatureComponentUpdated = function( focusedFamilyId, elementRefList ) {
    let found = false;
    if( focusedFamilyId && elementRefList.get( 'pca0FeaturesFamilies' ).current ) {
        const el = elementRefList.get( 'pca0FeaturesFamilies' ).current;
        [ ...el.childNodes ].forEach( ( child ) => {
            if( !found && child.id === 'pca0FeaturesFamilies_' + focusedFamilyId ) {
                child.scrollIntoView( { behavior: 'smooth' } );
                found = true;
            }
        } );
    }
};

/**
 * Rendering method, gets triggered every time the props change
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FeaturesRenderFunction = ( props ) => {
    let { fields, viewModel, actions, i18n, elementRefList } = props;
    let { data } = viewModel;

    const variantRuleData = props.variant;
    const configuid = _.get( variantRuleData, 'value.configPerspective.uid' ) ? variantRuleData.value.configPerspective.uid : '';

    //fetch each family and incorporate the Pca0Family component into the rendering. Also for performance
    //do not pass the group object, the family will carry group id and display name (needed in summary for grouping) 
    //the fam index needs to be passed down to the family component for its values and thir updates 
    const fetchEachFamily = ( family, famIndex ) => {
        if( family.isFiltered ) {
            let fam = { ...family, groupDisplayName: data.scopeStruct.group.groupDisplayName, groupUID: data.scopeStruct.group.optGroup };
            return (
                <Pca0Family  famIndex={famIndex}  family={fam}  configuid={configuid}  key={family.familyStr} ></Pca0Family>
            );
        }
    };

    const renderFeatures = () => {
        if( _.get( data, 'scopeStruct.group.families.length' ) > 0 ) {
            return (
                <div className='aw-base-scrollPanel sw-column'>
                    {
                        data.groupMeta && data.groupMeta.showFilter &&  <AwPanelHeader> <AwTextBox  {...getField( 'data.filterText', fields )}  ></AwTextBox></AwPanelHeader>
                    }
                    <AwPanelBody>
                        <div className='aw-cfg-fscSummaryUserSelectionsList' ref={elementRefList.get( 'pca0FeaturesFamilies' )} >
                            {
                                data.scopeStruct.group.families.map( ( family, index ) => fetchEachFamily( family, index ) )
                            }
                        </div>
                    </AwPanelBody>
                </div>
            );
        }
    };

    return (
        renderFeatures()
    );
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

export default exports = {
    getScope,
    getCachedScopeData,
    getScopeData,
    getGroupMeta,
    addInlineFreeFormFeature,
    removeInlineFreeFormFeature,
    getScopeFamilyObjectFromFamilyID,
    updateVariantMode,
    getActiveVariantRules,
    showViolationsOnValidation,
    showNotificationMessage,
    getSelectionForVariantContext,
    getConfigurationMode,
    getConfigurationModeForLoadScopeData,
    getProfileSettings,
    showValidationErrorMessage,
    stayInManualMode,
    showUnableToSwitchToGuidedModeMessage,
    validateConfiguration,
    expandSystemSelections,
    showPackagePanel,
    clearScopeData,
    resetGroup,
    clearSystemSelectionsInManualMode,
    clearSystemSelectionsInFsc,
    clearAllSelectionsInFsc,
    clearAllSelections,
    updateGroupListInScopeView,
    createGroupsNode,
    createFreeFormFeature,
    filterFeatures,
    addFreeFormOptionValue,
    getRequestInfoForToggleManualGuidedMode,
    addRangeExpressionForEnumeratedFamily,
    updateRangeExpressionForEnumeratedFamily,
    removeRangeExpForEnumeratedFeature,
    updateValue,
    updateFamily,
    getSwitchingToGuidedMode,
    focusToFamily,
    updateSelectionStateAndSetIndicatorsOnExistingScopeData,
    removeViolationsFromCurrentGroup,
    pca0FeatureComponentUpdated,
    getRequestInfoForExpandSystemSelection,
    setIndicators,
    getScopeDataForExpand,
    getScopeDataForValidate,
    removeSelectionsFromCurrentGroup,
    pca0FeaturesRenderFunction,
    convertSelectedExpressionJsonObjectToString,
    getConfigPerspective
};
