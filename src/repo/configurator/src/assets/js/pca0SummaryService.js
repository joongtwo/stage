// Copyright (c) 2022 Siemens

/**
 * @module js/pca0SummaryService
 */
import appCtxSvc from 'js/appCtxService';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import colorDecoratorService from 'js/colorDecoratorService';
import cdmSvc from 'soa/kernel/clientDataModel';
import enumFeature from 'js/pca0EnumeratedFeatureService';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/Pca0ExpressionGridService';
import iconSvc from 'js/iconService';
import pca0Constants from 'js/Pca0Constants';
import viewModelObjectService from 'js/viewModelObjectService';
import $ from 'jquery';
import _ from 'lodash';

// MutationObserver is a Web API provided by modern browsers for detecting changes in the DOM.
// With this API one can listen to newly added or removed nodes,
// attribute changes or changes in the text content of text nodes
var lastSelectedFeature = null;

/**
 * Sort based on products group, product lines and summary models
 * @param {Object} selection selection to be queried for sort sequence
 * @return {Integer} Sort sequence
 */
function _getSortSequence( selection ) {
    var typeHierarchy = _.get( selection, 'vmo.modelType.typeHierarchyArray', null );

    if( typeHierarchy !== null && typeHierarchy.includes( 'Cfg0AbsProductLine' ) ) {
        return -2;
    }
    if( typeHierarchy !== null && typeHierarchy.includes( 'Cfg0AbsSummaryModel' ) ) {
        return -1;
    }
    return 0;
}

/**
 * Get icon URL for unconfigured object
 * @returns {String} icon URL
 */
var _getUnconfiguredIconURL = function() {
    return iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_UNCONFIGURE_OBJ );
};

/**
 * Create a client side VMO for Unconfigured selection in summary
 * @param {String} displayName display name for unconfigured vmo
 * @return {Object} unconfigured VMO
 */
var _createUnconfiguredClientSideVMO = function( displayName ) {
    var iconName = pca0Constants.CFG_INDICATOR_ICONS.SVG_UNCONFIGURE_OBJ;
    return {
        modelType: {
            // needed to set icon by controller aw-image-cell.controller from aw-option-value-cell
            constantsMap: {
                IconFileName: iconName
            }
        },
        objectID: displayName,
        uid: '_unconfiguredFeature_',
        name: displayName,
        cellHeader1: displayName,
        cellHeader2: displayName,
        typeIconURL: _getUnconfiguredIconURL(),
        indicators: [],
        getId: function() {
            return this.uid;
        }
    };
};

var exports = {};

//ToDo to be revisited: disable for now as it doesn't work properly and also does not play nice with jest/unit testing.
// Initialize the MutationObserver
// track added nodes in the Summary User Selection looking for last selected feature
// export let callbackMutations = function( mutations ) {
//     mutations.forEach( function( mutation ) {
//         if( mutation.addedNodes.length !== 0 && lastSelectedFeature && lastSelectedFeature !== '' ) {
//             for( var idxNode = 0; idxNode < mutation.addedNodes.length; idxNode++ ) {
//                 if(mutation.addedNodes[ idxNode ].parentElement.className === "aw-cfg-fscSummaryUserSelectionsList"){
//                     $( mutation.addedNodes[ idxNode ] )[ 0 ].scrollIntoView();
//                                  exports.mutationObserver.disconnect();
//                                  break;
//                 }
//                 // if( mutation.addedNodes[ idxNode ].className === 'aw-widgets-cellListCellTitle' ) {
//                 //     if( mutation.addedNodes[ idxNode ].getAttribute( 'cellTitleid' ) === 'CellTitle' ) {
//                 //         if( mutation.addedNodes[ idxNode ].title === lastSelectedFeature ) {
//                 //             $( mutation.addedNodes[ idxNode ] )[ 0 ].scrollIntoView();
//                 //             exports.mutationObserver.disconnect();
//                 //             break;
//                 //         }
//                 //     }
//                 // }
//             }
//         }
//     } );
// };
// export let mutationObserver = new MutationObserver( callbackMutations );

/**
 * Toggle expand/collapse for Variants section
 * @param {Object} data VM data
 * @return {Boolean} true if section is expanded
 */
export let toggleVariantsSectionExpansion = function( data ) {
    return !data.variantsSectionExpand;
};

/**
 * Toggle expand/collapse for User Selections section
 * @param {Object} data VM data
 * @return {Boolean} true if section is expanded
 */
export let toggleUserSelectionsSectionExpansion = function( data ) {
    return !data.userSelectionsSectionExpand;
};

/**
 * This method takes care of the state set/resets for own props and parent's
 * @param {String} summarystate - the prop to update passed from parent
 * */
export let initSummaryState = function( summarystate ) {
    // update the state of the parent and avoid having to use global context and events
    if( summarystate && summarystate.update ) {
        let newSummaryState = { ...summarystate.value };
        if( summarystate.getValue ) {
            newSummaryState = { ...summarystate.getValue() }; //assure it's fresh
        }

        //reset the isCompletenessStatusChipEnabled
        newSummaryState.isCompletenessStatusChipEnabled = false;
        newSummaryState.completenessStatus = '';
        newSummaryState.severity = '';

        summarystate.update( newSummaryState );
    }
    return true;
};

/**
 * This method updates the completeness status in summary view
 * @param {String} completenessStatus - The completeness status needed to be set in summary view
 * @param {String} data - The view model data
 * */
export let updateCompletenessStatus = function( data, summarystate ) {
    let eventData = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0FullScreenSummary.updateCompletenessStatus' );

    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    let newSubPanelContext = { ...summarystate.value };
    if( summarystate.getValue ) {
        newSubPanelContext = { ...summarystate.getValue() }; //assure it's fresh
    }
    if( eventData ) {
        newSubPanelContext.completenessStatus = eventData.CompletenessStatus;
    }
    let chipEnabled = newSubPanelContext.isCompletenessStatusChipEnabled;
    // When completeness status is changed we need to enable the chip
    if( !newSubPanelContext.isCompletenessStatusChipEnabled ) {
        chipEnabled = true;
    }
    newSubPanelContext.isCompletenessStatusChipEnabled = chipEnabled;
    summarystate.update( newSubPanelContext );
};

/**
 * This method disables the completeness status chip in summary view
 * @param {Object} data VM data
 * @param {String} summarystate - the prop to update passed from parent
 * */
export let disableCompletenessStatusChip = function( summarystate ) {
    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    let newSubPanelContext = { ...summarystate.value };
    if( summarystate.getValue ) {
        newSubPanelContext = { ...summarystate.getValue() }; //assure it's fresh
    }
    let chipEnabled = newSubPanelContext.isCompletenessStatusChipEnabled;
    if( chipEnabled ) {
        chipEnabled = false;
        newSubPanelContext.isCompletenessStatusChipEnabled = chipEnabled;
        summarystate.update( newSubPanelContext );
    }
};

/**
 * This method updates list of user selections in FSC context
 * It will be used to build/synchronize viewmodel's list of enriched/extended user's selections
 * We keep same data structure as in variantConfigContext and fscContext
 * (indexed by familyUID - as provided in aw-cfg-value-directive)
 * */
export let syncUserSelections = function( data ) {
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    let selectionData = commonUtils.getEventDataFromEventMap( data.eventMap, 'customVariantRule.userSelectionChanged' );

    let configExprMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );

    if( selectionData && Object.keys( selectionData ).length !== 0 ) {
        // Clone context.userSelections list and manipulate it to sync
        var currSelections = {};
        if( fscContext.allSelectionsExt ) {
            currSelections = { ...fscContext.allSelectionsExt };
        }
        // Note: event fired from aw-cfg-fsc-value-directive is not a 1:1 event
        // selection of one feature can imply deselection of another one
        // Approach:
        // 1) Refer to selection list in fscContext.selections to get a sync of correct selected items
        // 2) refer to eventData to populate user's selection with enriched information
        if( !configExprMap ) {
            return;
        }

        var fscContextFamilySelections = [];
        var fscFamilySelections = [];
        var fscContextFamilySelections = !_.isUndefined( configExprMap ) ? $.extend( true, [], configExprMap[ selectionData.familyUID ] ) : [];
        var fscFamilySelections = $.extend( true, [], currSelections[ selectionData.familyUID ] );

        // var fscContextFamilySelections = !_.isUndefined( configExprMap ) ? { fscContextFamilySelections, ...configExprMap[ selectionData.familyUID ] } : [];
        // var fscFamilySelections = { fscFamilySelections, ...currSelections[ selectionData.familyUID ] };

        // Look for selections to be updated (selectionState) and removed
        var indexToRemove = [];
        for( var i = 0; i < fscFamilySelections.length; i++ ) {
            var found = false;
            for( var j = 0; j < fscContextFamilySelections.length; j++ ) {
                let tmpUid = fscContextFamilySelections[ j ].family + ':' + fscContextFamilySelections[ j ].valueText;
                let tmpUid2 = fscContextFamilySelections[ j ].familyNamespace + ':' + fscContextFamilySelections[ j ].familyId + ':' + fscContextFamilySelections[ j ].valueText;
                // We use value text to create nodeID for enumerated and free form expression
                // As we dont send nodeUID in selected expressions for free form and enumerated expression
                let isEnumeratedRangeExpr = false;
                if( fscContextFamilySelections[ j ].props && fscContextFamilySelections[ j ].props.isEnumeratedRangeExpressionSelection &&
                    fscContextFamilySelections[ j ].props.isEnumeratedRangeExpressionSelection[ 0 ] ||
                    fscFamilySelections[ i ].isEnumeratedRangeExpr ) {
                    isEnumeratedRangeExpr = true;
                }

                if( ( selectionData.isEnumeratedRangeExpr || isEnumeratedRangeExpr || selectionData.isFreeForm || selectionData.isUnconfigured ) &&
                    ( tmpUid === fscFamilySelections[ i ].nodeID || tmpUid2 === fscFamilySelections[ i ].nodeID ) ) {
                    found = true;
                    // update selection state
                    fscFamilySelections[ i ].selectionState = fscContextFamilySelections[ j ].selectionState;
                } else {
                    if( fscContextFamilySelections[ j ].nodeUid === fscFamilySelections[ i ].nodeID ) {
                        found = true;
                        // update selection state
                        fscFamilySelections[ i ].selectionState = fscContextFamilySelections[ j ].selectionState;
                    }
                }
            }
            if( !found ) {
                // if variant doesn't contain nodeID, remove it
                indexToRemove.push( i );
            }
        }

        // Remove out-dated selections
        if( indexToRemove.length > 1 ) {
            indexToRemove.sort( ( a, b ) => b - a ); //Sort the indexes in descending order
        }
        for( var i = 0; i < indexToRemove.length; i++ ) {
            if( indexToRemove[ i ] !== null && indexToRemove[ i ] > -1 ) {
                fscFamilySelections.splice( indexToRemove[ i ], 1 );
            }
        }

        // Look for New selections to copy into FSC context
        for( var j = 0; j < fscContextFamilySelections.length; j++ ) {
            var newSelection = true;
            let tmpUid = fscContextFamilySelections[ j ].family + ':' + fscContextFamilySelections[ j ].valueText;
            let tmpUid2 = fscContextFamilySelections[ j ].familyNamespace + ':' + fscContextFamilySelections[ j ].familyId + ':' + fscContextFamilySelections[ j ].valueText;
            for( var i = 0; i < fscFamilySelections.length; i++ ) {
                let isEnumeratedRangeExpr = false;
                if( fscContextFamilySelections[ j ].props && fscContextFamilySelections[ j ].props.isEnumeratedRangeExpressionSelection &&
                    fscContextFamilySelections[ j ].props.isEnumeratedRangeExpressionSelection[ 0 ] ||
                    fscFamilySelections[ i ].isEnumeratedRangeExpr ) {
                    isEnumeratedRangeExpr = true;
                }

                if( ( selectionData.isEnumeratedRangeExpr || isEnumeratedRangeExpr || selectionData.isFreeForm || selectionData.isUnconfigured ) &&
                    ( tmpUid === fscFamilySelections[ i ].nodeID || tmpUid2 === fscFamilySelections[ i ].nodeID ) ) {
                    newSelection = false;
                    break;
                } else {
                    if( fscFamilySelections[ i ].nodeID === fscContextFamilySelections[ j ].nodeUid ) {
                        newSelection = false;
                        break;
                    }
                }
            }

            if( newSelection ) {
                if( fscContextFamilySelections[ j ].nodeUid === selectionData.nodeID ||
                    ( selectionData.isEnumeratedRangeExpr || selectionData.isFreeForm || selectionData.isUnconfigured ) &&
                    tmpUid === selectionData.nodeID ) {
                    var extInfo = {
                        familyUID: selectionData.familyUID,
                        familyDisplayName: selectionData.familyDisplayName,
                        nodeID: selectionData.nodeID,
                        featureDisplayName: selectionData.featureDisplayName,
                        featureDescription: selectionData.featureDescription,
                        groupUID: selectionData.groupUID,
                        groupSourceUid: selectionData.groupSourceUid,
                        groupDisplayName: selectionData.groupDisplayName,
                        isThumbnailDisplay: selectionData.isThumbnailDisplay,
                        isUnconfigured: selectionData.isUnconfigured,
                        selectionState: selectionData.selectionState,
                        vmo: selectionData.vmo,
                        isFamilySelection: selectionData.isFamilySelection,
                        isEnumeratedRangeExpr: selectionData.isEnumeratedRangeExpr
                    };
                    if( extInfo.vmo ) {
                        extInfo.vmo.familyUID = selectionData.familyUID;
                        extInfo.vmo.familyDisplayName = selectionData.familyDisplayName;
                        extInfo.vmo.isThumbnailDisplay = selectionData.isThumbnailDisplay;
                        extInfo.vmo.nodeID = selectionData.nodeID;
                    }

                    fscFamilySelections.push( extInfo );

                    // Keep track of last clicked feature only
                    if( selectionData.groupSourceUid !== pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID ) {
                        lastSelectedFeature = selectionData.featureDisplayName;
                    }
                }
            } else if( selectionData.groupSourceUid !== pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID ) {
                // Keep track of last clicked feature only
                lastSelectedFeature = '';
            }
        }
        currSelections[ selectionData.familyUID ] = fscFamilySelections;

        // If selection was deleted from fscContext and that was the only one,
        // the entire entry for the family needs to be removed
        // if that was the only selection, remove the entire entry for that family
        if( fscFamilySelections.length === 0 && fscContextFamilySelections.length === 0 ) {
            delete currSelections[ selectionData.familyUID ];
        }

        // Update context.allSelectionsExt
        fscContext.allSelectionsExt = currSelections;
        appCtxSvc.updateCtx( 'fscContext', fscContext );
    }

    delete data.eventData;
    return {
        summaryFocusedFamilyId: selectionData.familyUID,
        summaryFocusedId: selectionData.nodeID
    };
};

/**
 * This method updates list of user selections in presence of unconfigured option values
 * NOTE: this is not called when loading SVR having unconfigured options (in that case, selections are up-to-date)
 * @param {Object} data - The view model data
 * */
export let reviewConfiguredOptions = function( data ) {
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    // SOA response is containing updated selections when features is configured-out *in guided mode only*
    // (e.g. Terms are updated in case of unconfigured data with value text instead of UID)
    // If feature is configured-out in manual mode, selections are not changing yet (implementation to come)
    // allSelectionsExt object needs to be updated: loop through scopes to replace UID with valueText for unconfigured data (as in allScopes)

    // This logic will partially go away when enhanced metadata will be present in output.selections
    var currSelections = {};
    if( fscContext.allSelectionsExt ) {
        currSelections = { ...fscContext.allSelectionsExt };
    }
    var scopes = data.eventData;
    // Find Family in provided scopes to check for Configured in/out options
    // This is used to set Unconfigured indicator
    // It is also used to update selection nodeID when selection is configured out in manual mode [output.selections are not updated yet]
    // var familyFound = false;
    for( var familyUID in currSelections ) {
        for( var itr = 0; itr < scopes.variabilityTreeData.length; itr++ ) {
            var node = scopes.variabilityTreeData[ itr ];
            for( var idx = 0; idx < currSelections[ familyUID ].length; idx++ ) {
                var plainSelection = currSelections[ familyUID ][ idx ];
                if( node.nodeUid === plainSelection.nodeID ) {
                    if( node.props && node.props.isUnconfigured && node.props.isUnconfigured[ 0 ] === 'true' ) {
                        plainSelection.isUnconfigured = true;
                        plainSelection.vmo.typeIconURL = _getUnconfiguredIconURL();
                    } else {
                        delete plainSelection.isUnconfigured;
                        var iconName = '';
                        if( node.props && node.props.isProductModelFamily && node.props.isProductModelFamily[ 0 ] === 'true' ) {
                            iconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_PROD_MODEL_REVISION;
                        } else {
                            iconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION;
                        }
                        plainSelection.vmo.typeIconURL = iconSvc.getTypeIconURL( iconName );
                    }
                }
            }
        }
    }

    // Update context.allSelectionsExt
    fscContext.allSelectionsExt = currSelections;
    appCtxSvc.updateCtx( 'fscContext', fscContext );

    eventBus.publish( 'Pca0Summary.displaySummarySelections' );
};

/**
 * This method elaborates list of Product Models selections
 * It also initializes data to allow image display, if any.
 * If user's profile allows the display of Product selected
 * 1) If only one product model is selected, show image and prominently show name of that model in the summary.
 * 2) If there is no image associated with the model, show the Product Model as Tile
 * 3) If more than one product model is selected [Manual mode], do not show image of any of them, just tiles.
 * @param {Object} data - The view model data
 */
export let getProductModelsSelectionsList = function( data ) {
    // Clear ProductData for the view model
    var prodSelections = {
        hasData: false,
        productModelsSelectionsList: [],
        selModelImage: '',
        selModelName: ''
    };

    var productSelections = data.data.productSelections;
    if( _.isUndefined( productSelections ) || productSelections.length === 0 ) {
        return;
    }
    prodSelections.hasData = true;

    // Display Image for Guided mode only (single selection only), if an image is associated
    // We do here all the logic, to keep it simple and clean in the html
    var isShowProductPicture = true; // TODO: this will be set as preference
    var configMode = configuratorUtils.getConfigurationMode( 'fscContext' );

    if( configMode === 'guided' && isShowProductPicture && productSelections[ 0 ] && productSelections[ 0 ].thumbnailURL !== '' ) {
        // In Guided mode, we cannot exclude the model, or have more than one selection
        prodSelections.selModelImage = productSelections[ 0 ].thumbnailURL;
        prodSelections.selModelName = productSelections[ 0 ].cellHeader1;
        prodSelections.productModelsSelectionsList = productSelections;
    } else {
        // Show tiles and populate data provider
        // show exclusions as well
        if( !productSelections.productModelsSelectionsList ) {
            prodSelections.productModelsSelectionsList = productSelections;
        } else {
            prodSelections = productSelections;
        }
    }

    return prodSelections;
};

/**
 * This method elaborates list of user selections
 * and connects to Mutation Observer to adjust scrollbar
 * @param {Object} data - The view model data
 */
export let getUserSelectionsList = function( data ) {
    // Mutation Observer: Starts listening for changes in the Summary Panel
    // When Layout is in Horizontal Mode
    //var context = appCtxSvc.getCtx( 'fscContext' );

    //todo needs to be resolved in a different way
    // if( context.layout === 'Horizontal' ) {
    //     var scrollablePanel = $( '[panel-id=\'Pca0SummaryScrollableSections\']' )[ 0 ];

    //     if( scrollablePanel ) {
    //         exports.mutationObserver.observe( scrollablePanel, {
    //             attributes: true,
    //             characterData: true,
    //             childList: true,
    //             subtree: true,
    //             attributeOldValue: true,
    //             characterDataOldValue: true
    //         } );
    //     }

    // }

    return data.userSelectionsList;
};

/**
 * This method populates the 'loadedVariantsList' in view data
 * Updates data provider for the "Variant" summary section
 * If no variant rule is loaded, "Custom Configuration" is displayed
 * @param {Object} summaryState - The summary atomic data state prop
 * @param {Object} loadedSavedVariantsProvider - loaded SVR Provider in order to update selection
 */
export let getLoadedSavedVariants = function( summarystate, loadedSavedVariantsProvider ) {
    var loadedVariantsList = [];
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    var initialVariantRule;

    if( fscContext.initialVariantRule ) {
        //decorator on the object will get lost using spread operator or if simply copy the uid and the cell 
        //headers like with the custom config below. The entire object will get replaced with found model object uid and will 
        //construct new vmo based on it  but without the decorators. 
        initialVariantRule = _.clone( fscContext.initialVariantRule );
    } else {
        // Create VMO
        var svrIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_VARIANT_RULE;
        var imageIconUrl = iconSvc.getTypeIconURL( svrIconName );
        initialVariantRule = {
            uid: '__custom__configuration__',
            cellHeader1: configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle,
            cellHeader2: configuratorUtils.getFscLocaleTextBundle().customConfigurationTitle,
            typeIconURL: imageIconUrl
        };
    }
    loadedVariantsList[ 0 ] = initialVariantRule;
    delete loadedVariantsList[ 0 ].selected;

    // Update Indicator
    loadedVariantsList[ 0 ].indicators = [];
    let val = _.get( summarystate, 'value' ) ? summarystate.value : undefined;
    if( val && val.variantRuleDirty ) {
        var indicator = {
            tooltip: configuratorUtils.getFscLocaleTextBundle().unsavedChanges,
            image: 'indicatorUnsaved'
        };
        loadedVariantsList[ 0 ].indicators.push( indicator );
    }

    loadedVariantsList[ 0 ].colorTitle = 'Unique';
    var decoratorStyle = '';
    if( val ) {
        decoratorStyle = exports.getDecoratorsStyle( val.variantRuleDirty );
    }
    loadedVariantsList[ 0 ].cellDecoratorStyle = decoratorStyle;
    loadedVariantsList[ 0 ].gridDecoratorStyle = decoratorStyle;
    colorDecoratorService.setDecoratorStyles( loadedVariantsList[ 0 ] );
    eventBus.publish( 'decoratorsUpdated', loadedVariantsList[ 0 ] );

    //also clean dp of any items it may contain do not rely on the return value, it does not always work, some timing issue
    loadedSavedVariantsProvider.viewModelCollection.clear();
    loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects = [ loadedVariantsList[ 0 ] ];
    loadedSavedVariantsProvider.viewModelCollection.setTotalObjectsFound( 1 );


    return loadedVariantsList;
};

/**
 * This method provides decorators style on Variant cell for loaded SVR
 * Change is according to isDirty status on the context
 * @param {Object} variantRulePanelDirty - dirty flag
 * @return {String} decorator style
 */
export let getDecoratorsStyle = function( variantRulePanelDirty ) {
    if( variantRulePanelDirty ) {
        return 'aw-widgets-showCellDecorator aw-cfg-fscBorder-chartColorModified';
    }
    return 'aw-widgets-showCellDecorator aw-cfg-fscBorder-chartColorUnchanged';
};

/**
 * This API returns initialVariantRule only when selections are undefined
 *
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function() {
    var context = appCtxSvc.getCtx( 'fscContext' );
    if( context.selectedExpressions === undefined ) {
        return [ context.initialVariantRule ];
    }
    return null;
};

/** This API processes the server response.responseInfo when a Saved Variant Rule (or No Variant Rule) is being loaded
 *  Data contains details of product and features selections
 *  This information is provided as JSON object in responseInfo.summaryOfSelections
 *  Update context
 */
export let loadVariantData = function( data ) {
    var selections = [];
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    var response = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0FullScreenSummary.loadVariantData' );
    if( !_.isEmpty( response ) && !_.isUndefined( response.responseInfo ) ) {
        if( !_.isEmpty( response.responseInfo.hasUnconfiguredData ) &&
            response.responseInfo.hasUnconfiguredData[ 0 ] === 'true' ) {
            fscContext.hasUnconfiguredData = true;
        }

        var selectionsListFromJson = JSON.parse( response.responseInfo.summaryOfSelections[ 0 ] );
        if( selectionsListFromJson && selectionsListFromJson.summaryOfSelections ) {
            for( var i = 0; i < selectionsListFromJson.summaryOfSelections.length; i++ ) {
                var selectionInfo = selectionsListFromJson.summaryOfSelections[ i ];
                var selection = {};
                selection.familyUID = selectionInfo.familyUID;
                selection.familyDisplayName = selectionInfo.familyDisplayName;
                selection.isFamilySelection = selectionInfo.isFamilySelection;
                //aw-cfg-value.directive provides $scope.value.optValueStr
                // which is <familyUID>:<featureUID>
                selection.nodeID = selectionInfo.featureUID;
                if( selectionInfo.isFamilySelection ) {
                    selection.nodeID = selectionInfo.familyUID;
                }
                selection.featureDisplayName = selectionInfo.featureDisplayName;
                selection.featureDescription = selectionInfo.featureDescription;
                selection.groupUID = selectionInfo.groupUID;
                selection.groupDisplayName = selectionInfo.groupDisplayName;
                selection.isThumbnailDisplay = selectionInfo.isThumbnailDisplay;
                selection.isUnconfigured = selectionInfo.isUnconfigured;
                selection.selectionState = selectionInfo.selectionState;
                selection.groupSourceUid = selectionInfo.sourceUid;
                let wsObject = cdmSvc.getObject( selectionInfo.featureUID );
                let isEnumeratedFeature = false;
                if( wsObject ) {
                    selection.vmo = viewModelObjectService.createViewModelObject( wsObject );
                    selection.vmo.familyDisplayName = selectionInfo.familyDisplayName;
                    selection.vmo.familyUID = selectionInfo.familyUID;
                    selection.vmo.familyDisplayName = selectionInfo.familyDisplayName;
                    selection.vmo.isThumbnailDisplay = selectionInfo.isThumbnailDisplay;
                } else if( selection.isUnconfigured ) {
                    if( selectionInfo.familyUID === '' ) {
                        fscContext.isFamilyUnconfigured = true;
                        selection.familyUID = selection.familyDisplayName;
                        selection.nodeID = selection.familyDisplayName + ':' + selection.featureDisplayName;
                    }
                    // when loading variant with unconfigured selections
                    var vmo = _createUnconfiguredClientSideVMO( selectionInfo.featureDisplayName );
                    vmo.familyDisplayName = selectionInfo.familyDisplayName;
                    vmo.familyUID = selectionInfo.familyUID;
                    vmo.isThumbnailDisplay = true;
                    selection.vmo = vmo;
                    selection.isThumbnailDisplay = true;
                } else {
                    // This is for FreeForm features
                    selection.nodeID = selection.familyUID + ':' + selection.featureDisplayName;
                    var displayName = selectionInfo.featureDisplayName;
                    const vmoMap = response.viewModelObjectMap;
                    if( vmoMap && vmoMap[ selection.familyUID ] && vmoMap[ selection.familyUID ].props ) {
                        const vmoProps = vmoMap[ selection.familyUID ].props;
                        const displayValues = _.get( vmoProps, 'cfg0ChildrenDisplayNames' );
                        const ids = _.get( vmoProps, 'cfg0ChildrenIDs' );
                        if( displayValues && ids ) {
                            displayName = enumFeature.getDisplayNamesForEnumeratedFeature( displayName, ids, displayValues );
                            isEnumeratedFeature = true;
                        }
                    }
                    if( displayName !== '' ) {
                        var vmo = {
                            uid: '_freeFormFeature_',
                            cellHeader1: displayName,
                            typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION ),
                            indicators: []
                        };
                        selection.vmo = vmo;
                        selection.isThumbnailDisplay = true;
                    }
                }

                let formattedDisplayName = selectionInfo.featureDisplayName;
                let dateInUTC = selectionInfo.featureDisplayName;
                //for date type family
                if( formattedDisplayName !== '' && !isEnumeratedFeature ) {
                    let isDateFeature = false;
                    const found = formattedDisplayName.match( /T00:00:00[+|-|Z]/ );
                    if( found && found.length > 0 ) {
                        // if string is end with  '* T00:00:00+530
                        isDateFeature = true;
                    }
                    if( isDateFeature || formattedDisplayName.endsWith( 'T00:00:00Z' ) ) {
                        const result = formattedDisplayName.split( ' ' );
                        if( result.length > 1 ) {
                            const fromOp = result[ 0 ];
                            const fromDate = result[ 1 ];
                            const toOp = result[ 3 ];
                            const toDate = result[ 4 ];
                            const fromDateStr = commonUtils.getFormattedDateFromUTC( fromDate );
                            formattedDisplayName = fromOp + ' ' + fromDateStr;
                            if( result[ 3 ] && result[ 4 ] ) {
                                const toDateStr = commonUtils.getFormattedDateFromUTC( toDate );
                                formattedDisplayName += ' & ' + toOp + ' ' + toDateStr;
                            }
                        } else {
                            formattedDisplayName = commonUtils.getFormattedDateFromUTC( formattedDisplayName );
                        }
                        // We use featureDisplayName to store DB value and for Date type family it should be UTC date
                        selection.featureDisplayName = dateInUTC;
                        if( selection.vmo ) {
                            selection.vmo.cellHeader1 = formattedDisplayName;
                        }
                    }
                }

                var existingItem = _.find( selections, sel => sel.familyUID === selection.familyUID && sel.vmo.cellHeader1 === selection.vmo.cellHeader1 );
                if( !existingItem ) {
                    selections.push( selection );
                }
            }
        }
    }

    // Update fscContext.allSelectionsExt
    // We need to keep same data structure as in variantConfigContext and fscContext
    // (indexed by familyUID - as provided in aw-cfg-fsc-value-directive)
    var groupByFamilyUID = _.groupBy( selections, 'familyUID' );
    fscContext.allSelectionsExt = groupByFamilyUID;
    appCtxSvc.updateCtx( 'fscContext', fscContext );

    eventBus.publish( 'Pca0Summary.displaySummarySelections' );
};

export let showViolationInfoInFscSummary = function( eventData, summarystate ) {
    var severity = { ...summarystate.violationSeverity };

    if( eventData && eventData.summaryViolationsInfo !== undefined ) {
        if( eventData.summaryViolationsInfo.some( d => d.violationSeverity === 'error' ) ) {
            severity = 'error';
        } else if( eventData.summaryViolationsInfo.some( d => d.violationSeverity === 'warning' ) ) {
            severity = 'warning';
        } else {
            severity = 'info';
        }
    } else if( _.get( eventData, 'violationLabels.violations' ) ) {
        let warningsFound = false;
        let errorsFound = false;
        let violations = _.get( eventData, 'violationLabels.violations' );
        let numOfViolations = violations.length;
        for( let ix = 0; ix < numOfViolations; ix++ ) {
            let violation = violations[ ix ];
            for( let [ key, value ] of Object.entries( violation.nodeMap ) ) {
                if( value && Array.isArray( value ) ) {
                    if( value.some( x => x.props.serverity[ 0 ] === 'error' ) ) {
                        errorsFound = true;
                        break;
                    } else if( value.some( x => x.props.serverity[ 0 ] === 'warning' ) ) {
                        warningsFound = true;
                    }
                }
            }
            if( errorsFound ) {
                break;
            }
        }

        // Set the db value of severity
        if( errorsFound ) {
            severity = 'error';
        } else if( warningsFound ) {
            severity = 'warning';
        } else {
            severity = 'info';
        }
    } else {
        severity = '';
    }

    let violationLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().noViolations;
    if( eventData.validationErrorMessage !== undefined ) {
        violationLabel = eventData.validationErrorMessage;
    }
    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    //before doing anything get the fresh state of summary service data, you cannot rely on data transmitted from view model
    if( summarystate.update && summarystate.getValue ) {
        let newSubPanelContext = { ...summarystate.getValue() };
        if( newSubPanelContext.violationSeverity !== severity ) {
            newSubPanelContext.violationSeverity = severity;
            summarystate.update( newSubPanelContext );
        }
    }

    return violationLabel;
};

/**
 * This method outputs the label to display for progress and resets the flag
 * @param {String} violationLabel - violation Label
 * @param {Object} summarystate - summarystate atomic data
 * @returns {String} violationlabel
 */
export let displayValidationInProgressLabel = function( violationLabel, summarystate ) {
    let validationInProgressLabel = violationLabel;
    if( summarystate.getValue && summarystate.value.isValidationInProgress ) {
        let newSubPanelContext = { ...summarystate.getValue() };
        newSubPanelContext.isValidationInProgress = false;
        summarystate.update( newSubPanelContext );
        validationInProgressLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().validationInProgress;
    }
    return validationInProgressLabel;
};

export let updateUserSelectionsSectionExpansion = function( data ) {
    var productSelections = !_.isUndefined( data.productSelections ) && data.productSelections.hasData ? 1 : 0; // don;t care about actual length
    var userSelections = !_.isUndefined( data.userSelectionsList ) ? data.userSelectionsList.length : 0;
    return productSelections + userSelections > 0;
};

// Convert current context selections to a format suitable for list data providers
// Fire events
export let displaySummarySelections = function() {
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    var productSelections = [];
    var userSelections = [];

    // Selections are in sync - indexed by familyUID
    // We need to elaborate a plain collection objects suitable for display in grouped aw-list
    // presenting selections alphabetically (Ascending) sorted by Group, Family and Feature

    // Selections are indexed by FamilyUID
    // Need to sort them by Group displayName
    var plainSelections = [];
    if( fscContext.allSelectionsExt ) {
        var selectionValues = Object.values( fscContext.allSelectionsExt );
        for( var idx = 0; idx < selectionValues.length; idx++ ) {
            for( var idx1 = 0; idx1 < selectionValues[ idx ].length; idx1++ ) {
                plainSelections.push( $.extend( true, [], selectionValues[ idx ][ idx1 ] ) );
            }
        }
    }

    // Step 1: Sort by GroupDisplayName
    let sortNo1;
    let sortNo2;
    plainSelections.sort( function( selectionA, selectionB ) {
        sortNo1 = _getSortSequence( selectionA );
        sortNo2 = _getSortSequence( selectionB );

        if( sortNo1 !== sortNo2 ) {
            if( sortNo1 < sortNo2 ) {
                return -1;
            }
            if( sortNo1 > sortNo2 ) {
                return 1;
            }
        }
        var nameA = selectionA.groupDisplayName.toLowerCase();
        var nameB = selectionB.groupDisplayName.toLowerCase();
        if( nameA < nameB ) { //sort string ascending
            return -1;
        }
        if( nameA > nameB ) {
            return 1;
        }
        return 0; //default return value (no sorting)
    } );

    // Step 2: Group by GroupDisplayName
    var groupedSelections = Object.values( _.groupBy( plainSelections, 'groupDisplayName' ) );

    // Step 3: Sort by FamilyDisplayName within each group
    var userSelectionEntries = [];
    for( var idxGroup = 0; idxGroup < groupedSelections.length; idxGroup++ ) {
        var groupedFamilies = groupedSelections[ idxGroup ];
        groupedFamilies.sort( function( selectionA, selectionB ) {
            sortNo1 = _getSortSequence( selectionA );
            sortNo2 = _getSortSequence( selectionB );
            if( sortNo1 !== sortNo2 ) {
                if( sortNo1 < sortNo2 ) {
                    return -1;
                }
                if( sortNo1 > sortNo2 ) {
                    return 1;
                }
            }
            var nameA = selectionA.familyDisplayName.toLowerCase();
            var nameB = selectionB.familyDisplayName.toLowerCase();
            if( nameA < nameB ) { //sort string ascending
                return -1;
            } else if( nameA > nameB ) {
                return 1;
            }
            return 0; //default return value (no sorting)
        } );

        // Step 4: Group by Family name
        var groupedFeatures = Object.values( _.groupBy( groupedFamilies, 'familyDisplayName' ) );

        // Step 5: Sort features
        for( var idxFeature = 0; idxFeature < groupedFeatures.length; idxFeature++ ) {
            var familySelections = groupedFeatures[ idxFeature ];
            familySelections.sort( function( selectionA, selectionB ) {
                if( !_.isEmpty( selectionA.vmo ) && !_.isEmpty( selectionB.vmo ) ) {
                    var nameA = selectionA.vmo.cellHeader1.toLowerCase();
                    var nameB = selectionB.vmo.cellHeader1.toLowerCase();
                    if( nameA < nameB ) { //sort string ascending
                        return -1;
                    }
                    if( nameA > nameB ) {
                        return 1;
                    }
                }
                return 0; //default return value (no sorting)
            } );
            userSelectionEntries = userSelectionEntries.concat( familySelections );
        }
    }

    for( var j = 0; j < userSelectionEntries.length; j++ ) {
        // For now, display only selectionState = 1 (selection) and selectionState = 2 (excluded selections)
        if( ![ 1, 2 ].includes( userSelectionEntries[ j ].selectionState ) ) {
            continue;
        }

        var selectionEntry = userSelectionEntries[ j ];
        var item = {
            familyDisplayName: selectionEntry.familyDisplayName,
            isThumbnailDisplay: selectionEntry.isThumbnailDisplay,
            familyUID: selectionEntry.familyUID,
            name: selectionEntry.featureDisplayName,
            cellHeader1: selectionEntry.featureDisplayName,
            cellHeader2: selectionEntry.featureDescription,
            selectionState: selectionEntry.selectionState,
            isFamilySelection: selectionEntry.isFamilySelection,
            isUnconfigured: selectionEntry.isUnconfigured
        };

        if( selectionEntry.vmo !== undefined ) {
            // need to break any reference to fscContext.allSelectionsExt, or indicator changes will reflect to middle Panel
            // need to change indicators in summary (i.e. here "exclude") without affecting source vmo
            //only do it for regular objects that have a filled in vmo
            if( selectionEntry.vmo.familyUID ) {
                item = { ...selectionEntry.vmo };
            } else {
                //the loaded free form fields need the above info
                item = { ...item, ...selectionEntry.vmo };
            }
            // Reset indicators: allowed indicators in Summary:
            // - excluded selections
            // - unconfigured option
            item.indicators = [];
            // Check for indicator duplicates (we are not resetting indicators array)
            if( selectionEntry.selectionState === 2 ) {
                var excludeIndicator = {
                    tooltip: configuratorUtils.getFscLocaleTextBundle().excludedSelectionLabel,
                    image: 'miscUiExcludeBox'
                };
                item.indicators.push( excludeIndicator );
            }
            if( selectionEntry.isUnconfigured ) {
                var unconfiguredIndicator = {
                    tooltip: configuratorUtils.getFscLocaleTextBundle().isUnconfigured,
                    image: 'indicatorConfiguredOut'
                };
                item.indicators.push( unconfiguredIndicator );
            }
        }

        // In case of Unconfigured values, there is no hierarchy available
        var ignoreHierarchy = false;
        var typeHierarchy = _.get( selectionEntry, 'vmo.modelType.typeHierarchyArray', null );
        if( typeHierarchy !== null ) {
            typeHierarchy = selectionEntry.vmo.modelType.typeHierarchyArray;
        } else {
            ignoreHierarchy = true;
        }

        if( ( selectionEntry.groupSourceUid === pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID ||
            selectionEntry.groupUID === pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID )
            && ( ignoreHierarchy && !selectionEntry.isFamilySelection || typeHierarchy && typeHierarchy.includes(
                'Cfg0AbsProductModel' ) ) ) {
            productSelections.push( item );
        } else {
            var existingItem = _.find( userSelections, sel => sel.familyUID === item.familyUID && sel.cellHeader1 === item.cellHeader1 );
            if( !existingItem ) {
                userSelections.push( item );
            }
        }
    }

    return {
        productSelections: productSelections,
        userSelectionsList: userSelections
    };
};

/**
 * This method is just an interim workaround and a backup for now in case we ever run into the duplicate vmo situation
 * because in certain situations that vary, probably timing issues, the view model collection can get a duplicate vmo in the AwList ViewModelCollection. 
 * This is a todo for next release as we should not use awList for one object only.
 * It will forcefully remove the second one if that situation ever occurs, otherwise it simply returns the loadedVMObjects
 * @param {Object} loadedSavedVariantsProvider - loadedSavedVariantsProvider
 * @return {Object} loadedVMObjects
 */
export let removeDuplicates = function( loadedSavedVariantsProvider ) {
    let loadedObj = loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects;
    if(  loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects &&
        loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects.length > 1 ) {
        loadedSavedVariantsProvider.viewModelCollection.clear();
        loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects = [ loadedObj[ 0 ] ];
        loadedSavedVariantsProvider.viewModelCollection.setTotalObjectsFound( 1 );
    }
    return loadedObj;
};

export default exports = {
    toggleVariantsSectionExpansion,
    toggleUserSelectionsSectionExpansion,
    initSummaryState,
    updateCompletenessStatus,
    disableCompletenessStatusChip,
    syncUserSelections,
    reviewConfiguredOptions,
    getProductModelsSelectionsList,
    getUserSelectionsList,
    getLoadedSavedVariants,
    getDecoratorsStyle,
    getActiveVariantRules,
    loadVariantData,
    showViolationInfoInFscSummary,
    displayValidationInProgressLabel,
    updateUserSelectionsSectionExpansion,
    displaySummarySelections,
    removeDuplicates
};
