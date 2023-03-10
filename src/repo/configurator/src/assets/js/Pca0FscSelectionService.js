// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0FscSelectionService
 */
import appCtxSvc from 'js/appCtxService';
import configuratorUtils from 'js/configuratorUtils';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/Pca0ExpressionGridService';
import pca0FeatureSvc from 'js/pca0FeaturesService';
import Pca0Constants from 'js/Pca0Constants';
import Pca0IncompleteFamiliesService from 'js/Pca0IncompleteFamiliesService';
import _ from 'lodash';

/**
 * This API does the following:<br>
 * 1. Check if value is selected and is present in the map and then update with new state<br>
 * 2. If value is not currently selected then add a new entry
 *
 * @param {Object} selectionObject - the Selection Object
 */
var addValueEntryToSelectionMap = function( selectionObject ) {
    var valueSelectionIndex = null;
    const isSpecialFeature = selectionObject.isEnumeratedRangeExpr || selectionObject.isFreeForm || selectionObject.isUnconfigured;
    const context = selectionObject.context;
    let optionValueSelections = selectionObject.optionValueSelections;
    const familyUID = selectionObject.familyUID;
    const optionValueUid = selectionObject.optionValueUid;
    const featureName = selectionObject.featureName;
    const state = selectionObject.state;
    for( var j = 0; j < optionValueSelections.length; j++ ) {
        let tmpUid = optionValueSelections[ j ].family + ':' + optionValueSelections[ j ].valueText;
        let tmpUid2 = optionValueSelections[ j ].familyNamespace + ':' + optionValueSelections[ j ].familyId + ':' + optionValueSelections[ j ].valueText;
        if( isSpecialFeature && ( tmpUid === optionValueUid || tmpUid2 === optionValueUid ) ) {
            valueSelectionIndex = j;
            break;
        } else {
            if( optionValueSelections[ j ].nodeUid === optionValueUid && optionValueUid !== '' ) {
                valueSelectionIndex = j;
                break;
            }
        }
    }
    if( context.guidedMode && optionValueSelections.length > 0 && valueSelectionIndex === null &&
        selectionObject.isFamilySingleSelect ) {
        // This is the case where we are in guided mode and we are switching selection for a single select
        // option family to a different value. We only need to keep one value selected here, so we remove the existing selection
        optionValueSelections.splice( 0, 1 );
    }

    if( selectionObject.isFamilySelection ) {
        //This is for family selection
        var nodeID = familyUID;
        var entryExists = false;
        optionValueSelections.forEach( function( selection ) {
            if( selection.nodeUid === nodeID ) {
                selection.selectionState = state;
                entryExists = true;
            }
        } );
        if( !entryExists ) {
            //Clear feature selections if any
            optionValueSelections = [];
            var newFamilySelection = {
                nodeUid: nodeID,
                selectionState: state,
                props: { isFamilyLevelSelection: [ 'true' ] }
            };
            optionValueSelections.push( newFamilySelection );
        }
    } else {
        if( valueSelectionIndex !== null && valueSelectionIndex > -1 ) {
            optionValueSelections[ valueSelectionIndex ].selectionState = state;
        } else {
            //Check if family selection is present in existing selections and delete it
            var nodeID = familyUID;
            if( !isSpecialFeature ) {
                for( var i = optionValueSelections.length - 1; i >= 0; i-- ) {
                    if( optionValueSelections[ i ].nodeUid === nodeID ) {
                        optionValueSelections.splice( i, 1 );
                        break;
                    }
                }
            } else {
                for( var i = optionValueSelections.length - 1; i >= 0; i-- ) {
                    let tmpUid = optionValueSelections[ i ].family + ':' + optionValueSelections[ i ].valueText;
                    let tmpUid2 = optionValueSelections[ i ].familyNamespace + ':' + optionValueSelections[ i ].familyId + ':' + optionValueSelections[ i ].valueText;
                    if( tmpUid === familyUID + ':' + featureName || tmpUid2 === familyUID + ':' + featureName ) {
                        optionValueSelections.splice( i, 1 );
                        break;
                    }
                }
            }
            // Add the newly selected value
            var newSelection = {
                familyId: '',
                family: familyUID,
                nodeUid: optionValueUid,
                selectionState: Number( state ),
                valueText: ''
            };

            if( isSpecialFeature ) {
                newSelection.valueText = featureName;
                newSelection.nodeUid = '';
            }
            if( selectionObject.isEnumeratedRangeExpr ) {
                newSelection.props = { isEnumeratedRangeExpressionSelection: [ 'true' ] };
            }
            if( selectionObject.isFreeForm ) {
                newSelection.props = { isFreeFormSelection: [ 'true' ] };
            }

            if( selectionObject.isUnconfigured ) {
                newSelection.props = { isUnconfigured: [ 'true' ] };
            }
            optionValueSelections.push( newSelection );
        }
    }
    let configExprMap = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );
    if( configExprMap ) {
        // Update the selection map
        configExprMap[ familyUID ] = optionValueSelections;
    }
};

/**
 * This API removes the value selection from selection map
 *
 * @param {Object} selectionObject - the Selection Object
 */
var removeValueEntryFromSelectionMap = function( selectionObject ) {
    // When new selection state is 0, we should remove the value from selection list
    var indexToRemove = null;
    const optionValueSelections = selectionObject.optionValueSelections;
    let optionValueUid = selectionObject.optionValueUid;
    for( var i = 0; i < optionValueSelections.length; i++ ) {
        if( selectionObject.isFamilySelection ) {
            optionValueUid = selectionObject.familyUID;
        }
        if( selectionObject.isEnumeratedRangeExpr || selectionObject.isFreeForm || selectionObject.isUnconfigured ) {
            let tmpUid = optionValueSelections[ i ].family + ':' + optionValueSelections[ i ].valueText;
            let tmpUid2 = optionValueSelections[ i ].familyNamespace + ':' + optionValueSelections[ i ].familyId + ':' + optionValueSelections[ i ].valueText;
            if( tmpUid === optionValueUid || tmpUid2 === optionValueUid ) {
                indexToRemove = i;
                break;
            }
        } else {
            if( optionValueSelections[ i ].nodeUid === optionValueUid && optionValueUid !== '' ) {
                indexToRemove = i;
                break;
            }
        }
    }
    if( indexToRemove !== null && indexToRemove > -1 ) {
        optionValueSelections.splice( indexToRemove, 1 );
    }
    let configExprMap = exprGridSvc.getConfigExpressionMap( selectionObject.context.selectedExpressions );
    if( optionValueSelections.length === 0 ) {
        // If no other value is selected for the family then we remove the
        // family entry from user selection map
        delete configExprMap[ selectionObject.familyUID ];
    } else {
        configExprMap[ selectionObject.familyUID ] = optionValueSelections;
    }
};

// Compute the completeness of family
var computeIncompleteFamily = function( selectionData ) {
    if( !selectionData.family.cfg0IsDiscretionary ) {
        selectionData.family.complete = false;
        var context = appCtxSvc.getCtx( selectionData.variantcontext );
        let configExprMap = exprGridSvc.getConfigExpressionMap( context.selectedExpressions );
        if( selectionData.family.familyStr in configExprMap ) {
            selectionData.family.complete = true;
        }
    }
};

/**
 * Util to create container for selection data for the family
 * @param {Object} commandContext context for command
 * @param {Number} state selection state
 * @returns {Object} selection data
 */
let _getSelectionDataForFamily = function( commandContext, state ) {
    return {
        variantcontext: 'fscContext',
        valueaction: 'selectFeature',
        value: undefined,
        family: commandContext.family,
        group: commandContext.groupMeta,
        state: state,
        perspectiveUid: commandContext.configPerspectiveUid
    };
};

/**
 * Initialize selected Expression Map object if needed
 * @param {Object} selectionData selection data
 * @param {Object} context - passed in context
 */
let _initializeExpressionMap = function( selectionData, context ) {
    let selectedExprMap = {};
    if( selectionData.perspectiveUid ) {
        // Set selection map as empty structure
        selectedExprMap[ selectionData.perspectiveUid ] = [ {
            formula: '',
            exprID: '',
            expressionType: Pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
            configExpressionSet: [ {
                configExpressionSections: []
            } ]
        } ];

        // Set default selected expression
        if( context.selectedExpressions === undefined || _.isEmpty( context.selectedExpressions ) ) {
            context.selectedExpressions = selectedExprMap;
        }

        let selectedExprArr;
        for( const key in context.selectedExpressions ) {
            if( context.selectedExpressions.hasOwnProperty( key ) ) {
                selectedExprArr = context.selectedExpressions[ key ];
                break;
            }
        }

        if( selectedExprArr && !_.isEmpty( selectedExprArr[ 0 ] ) ) {
            let configExprSectionObject = selectedExprArr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ];
            let emptyConfigExprSectionObj = {
                expressionType: Pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION,
                formula: '',
                subExpressions: [ { expressionGroups: {} } ]
            };

            // Set empty subexpression map
            if( selectedExprArr && ( configExprSectionObject === undefined || configExprSectionObject.subExpressions[ 0 ].expressionGroups === undefined ) ) {
                selectedExprArr[ 0 ].configExpressionSet[ 0 ].configExpressionSections[ 0 ] = emptyConfigExprSectionObj;
                selectedExprArr[ 0 ].expressionType = Pca0Constants.EXPRESSION_TYPES.USER_DEFINED_SELECTION;
            }
        }
    }
};

/**
 * Process selection in case of Family Selection
 * Set selection state on family, reset selection states on its features
 * Return selection object
 * @param {Object} selectionData the selection info container
 * @param {Object} context the Variant context
 * @returns {Object} the selection object
 */
let _processSelectionForFamilySelection = function( selectionData, context ) {
    // 1. Set selection state on family
    selectionData.family.selectionState = selectionData.state;

    // 2. Reset the selection state on all the features belonging to family
    let familyObj = pca0FeatureSvc.getScopeFamilyObjectFromFamilyID( selectionData.family.familyStr );
    familyObj.selectionState = selectionData.state;
    if( familyObj.values && familyObj.values.length > 0 ) {
        familyObj.values.forEach( function( value ) {
            // Clear the system selection indicator when system selection is converted to user selection
            if( !context.guidedMode && [ 5, 6, 9, 10 ].includes( value.selectionState ) && value.optValue ) {
                delete value.optValue.indicators;
            }

            value.selectionState = 0;
        } );
    }
    var nodeID = familyObj.familyStr;

    // 3. Create Selection object for customVariantRule.userSelectionChanged
    return {
        familyUID: selectionData.family.familyStr,
        familyDisplayName: selectionData.family.familyDisplayName,
        nodeID: nodeID,
        groupUID: context.currentScope,
        groupDisplayName: context.currentScopeName,
        selectionState: selectionData.state,
        isFamilySelection: true,
        isFreeForm: selectionData.isFreeForm,
        isUnconfigured: selectionData.isUnconfigured
    };
};

/**
 * Process selection in case of Feature Selection
 * Clear any system selection, update selectionState on feature, reset selection states on its family
 * Return selection object
 * @param {Object} selectionData the selection info container
 * @param {Object} context the Variant context
 * @param {Boolean} isEnumeratedRangeExpr True/False if expression is for feature in enumerated family
 * @returns {Object} the selection object
 */
let _processSelectionForFeatureSelection = function( selectionData, context, isEnumeratedRangeExpr ) {
    // 1. Clear the system selection indicator when system selection is converted to user selection
    if( !context.guidedMode && [ 5, 6, 9, 10 ].includes( selectionData.value.selectionState ) && selectionData.value.optValue ) {
        delete selectionData.value.optValue.indicators;
    }

    // 2. Set selection state on feature
    selectionData.value.selectionState = selectionData.state;

    // 3. Reset the selection state on family
    selectionData.family.selectionState = 0;
    let dispValue;
    if( selectionData.value && ( selectionData.value.isFreeFormFeature || isEnumeratedRangeExpr ) ) {
        dispValue = selectionData.value.dbValue;
    } else {
        dispValue = selectionData.value.valueDisplayName;
    }

    // 4. Create Selection object for customVariantRule.userSelectionChanged
    var selection = {
        familyUID: selectionData.family.familyStr,
        familyDisplayName: selectionData.family.familyDisplayName,
        nodeID: selectionData.value.optValueStr,
        featureDisplayName: dispValue,
        featureDescription: '',
        groupUID: context.currentScope,
        groupDisplayName: context.currentScopeName,
        isThumbnailDisplay: selectionData.value.isThumbnailDisplay,
        selectionState: selectionData.state,
        vmo: selectionData.value.optValue,
        isFamilySelection: false,
        isUnconfigured: selectionData.value.isUnconfigured,
        isFreeForm: selectionData.value.isFreeFormFeature,
        isEnumeratedRangeExpr: isEnumeratedRangeExpr
    };

    // Added seperately as selectionData.value.optValueStr is used for nodeUID
    // which want to ignore in this case
    if( isEnumeratedRangeExpr ) {
        selection.nodeID = selectionData.family.familyStr + ':' + dispValue;
    }
    return selection;
};

var exports = {};

/**
 * Set the selection for Family\Feature
 * Update user selection map
 * Trigger events to handle visibility of controls (completeness chip, save command, highlight incompleteness command, etc.)
 * @param {Object} selectionData selection event data
 * @param {Boolean} isFamilySelection true if selection is a family selection
 */
export let setSelection = function( selectionData, isFamilySelection ) {
    var context = appCtxSvc.getCtx( selectionData.variantcontext );
    _initializeExpressionMap( selectionData, context );

    // If new state is not in list of allowed states revert it to original state
    if( !isFamilySelection && context.guidedMode && selectionData.value.allowedSelectionStates &&
        selectionData.value.allowedSelectionStates.length > 0 &&
        selectionData.value.allowedSelectionStates.indexOf( selectionData.state ) < 0 ) {
        // If new state is not in allowed value states , further processing is not required, update the context to preserve logic
        appCtxSvc.updateCtx( selectionData.variantcontext, context );
        return;
    }

    var family = selectionData.family;
    var feature = undefined;
    var featureName = undefined;
    var isUnconfigured = false;
    let isEnumeratedRangeExpr = false;
    if( selectionData.value ) {
        isEnumeratedRangeExpr = selectionData.value.isEnumeratedRangeExpr;
        feature = selectionData.value.optValueStr;
        featureName = selectionData.value.valueDisplayName;
        if( isEnumeratedRangeExpr ) {
            // get server information
            let ids = family.cfg0ChildrenIDs;
            let displayValues = family.childrenDispValues;
            featureName = enumFeature.getServerNamesForEnumeratedFeature( selectionData.value.dbValue, ids, displayValues );
            selectionData.value.dbValue = featureName;
            feature = family.familyStr + ':' + featureName;
        }
        if( selectionData.value.isFreeFormFeature ) {
            featureName = selectionData.value.dbValue;
        }
        if( selectionData.value.type && selectionData.value.type.toUpperCase() === 'DATE' && isEnumeratedRangeExpr ) {
            featureName = selectionData.value.valueDisplayName ? selectionData.value.valueDisplayName : selectionData.value.dbValue;
        }
        if( selectionData.value.isUnconfigured ) {
            isUnconfigured = selectionData.value.isUnconfigured;
        }
    }
    const selectionObject = {
        context: context,
        familyUID: family.familyStr,
        isFamilySingleSelect: family.singleSelect,
        optionValueUid: feature,
        featureName: featureName,
        state: selectionData.state,
        isFamilySelection: isFamilySelection,
        isFreeForm: family.isFreeForm,
        isUnconfigured: isUnconfigured,
        isEnumeratedRangeExpr: isEnumeratedRangeExpr,
        type: family.familyType
    };
    updateUserSelectionMap( selectionObject );
    var familyComplete;
    if( context.guidedMode ) {
        // Invalidate cache of completeness information
        // Update current active family on context
        if( selectionData.variantcontext === 'fscContext' && configuratorUtils.isPlatformVersionAtleast( 13, 3 ) ) {
            //don't call the incomplete removal because of the additional update, use the batch update
            delete context.incompleteFamiliesInfo;
            context.activeFamilyUID = selectionObject.familyUID;
        }

        var viewName = 'Pca0Features';
        if( selectionData.variantcontext !== 'fscContext' ) {
            viewName = 'Pca0FSCPackage';
        }

        // Since we did update the context with all the transmitted info, following the event we will call the backend
        eventBus.publish( viewName + '.' + selectionData.valueaction );
    } else {
        // Handle completeness
        computeIncompleteFamily( selectionData );
        familyComplete = selectionData.family.complete;

        // Completeness chip in summary view: for any selection change
        // disable the completeness status chip to indicate its staleness. todo rename
        eventBus.publish( 'Pca0Summary.disableCompletenessStatusChip' );
    }

    // Publish the event to update the number of features selected in case the Load Variants Tab is open with filter Criteria as "Feature"
    if( context.loadVariantSearchCriteria && context.loadVariantSearchCriteria.staticElementObject === 'Feature' ) {
        context.loadVariantSearchCriteria.selected = true;
        let eventData = {
            activeSearchCriteria: { ...context.loadVariantSearchCriteria },
            dispValue: configuratorUtils.getFscLocaleTextBundle().feature
        };
        eventBus.publish( 'Pca0LoadSVRSearchCriteriaPanel.updateActiveSearchCriteria', eventData );
    }

    //update all context once - ctx updates are expensive, so prefer to batch if possible
    appCtxSvc.updateCtx( selectionData.variantcontext, context );

    // Fire event to control the visibility of Save command
    var eventData = {
        variantRulePanelDirty: true,
        selectedCtx: selectionData.variantcontext
    };
    eventBus.publish( 'customVariantRule.variantRuleDirty', eventData );

    var selection;
    if( isFamilySelection ) {
        selection = _processSelectionForFamilySelection( selectionData, context );
    } else {
        selection = _processSelectionForFeatureSelection( selectionData, context, isEnumeratedRangeExpr );
    }

    selection.familyComplete = familyComplete;
    selection.path =  selectionData.path;
    selection.newValue =  selectionData.value;

    if( 'fscContext' === selectionData.variantcontext && 'selectPackageOption' !== selectionData.valueaction ) {
        //Update Summary Selections accordingly
        eventBus.publish( 'customVariantRule.userSelectionChanged', selection );
    }
};

/**
 * Set 'Any' selection for Family
 * @param {Object} data - the View Model data
 */
export let setAnySelectionForFamily = function( data ) {
    var state = 1;
    if( data.family.selectionState === 1 ) {
        state = 0;
    }
    var fam = { ...data.family };
    fam.selectionState = state;
    eventBus.publish( 'Pca0FeaturesService.updateFamily', fam );

    var selectionData = _getSelectionDataForFamily( data, state );
    exports.setSelection( selectionData, true );
};

/**
 * Set 'None' selection for Family
 * @param {Object} data - the View Model data
 */
export let setNoneSelectionForFamily = function( data ) {
    var state = 2;
    if( data.family.selectionState === 2 ) {
        state = 0;
    }
    var fam = { ...data.family };
    fam.selectionState = state;
    eventBus.publish( 'Pca0FeaturesService.updateFamily', fam );

    var selectionData = _getSelectionDataForFamily( data, state );
    exports.setSelection( selectionData, true );
};

/**
 * This API updates the selection map with given option value selection *
 *
 * @param {Object} selectionObject - the selection Onject
 */
export let updateUserSelectionMap = function( selectionObject ) {
    var optionValueSelections = [];
    let configExprMap = exprGridSvc.getConfigExpressionMap( selectionObject.context.selectedExpressions );
    const familyUID = selectionObject.familyUID;
    if( configExprMap && familyUID in configExprMap &&
        configExprMap[ familyUID ] !== undefined ) {
        optionValueSelections = configExprMap[ familyUID ];
    }

    selectionObject.optionValueSelections = optionValueSelections;
    if( selectionObject.state === 0 ) {
        //Remove the value selection from map if new selection state is 0
        removeValueEntryFromSelectionMap( selectionObject );
    } else {
        //1. Check if value is selected and is present in the map and then update with new state
        //2. If value is not currently selected then add a new entry
        addValueEntryToSelectionMap( selectionObject );
    }
};

export default exports = {
    setSelection,
    setAnySelectionForFamily,
    setNoneSelectionForFamily,
    updateUserSelectionMap
};
