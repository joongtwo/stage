// Copyright (c) 2021 Siemens

/**
 * @module js/AwDiscoveryRecipeChipsUtils
 */

import _ from 'lodash';
import localeService from 'js/localeService';
var applicableCategoryTypes = [ 'Attribute', 'Partition' ];
import filterRecipeValidationService from 'js/filterRecipeValidationService';
import eventBus from 'js/eventBus';

export let calculateOverflow = ( elementRefList, totalVisibleArea, totalVisibleHeight, recipeChips, currentOverflowChips,
    displayRecipeChips, searchFilterCategoryExpandMore, visibleChipAreaMaintained ) => {
    var tabElems;
    var displayChips = [];
    var overflownChips = [];
    var breakIndex = null;

    if ( elementRefList ) {
        let chiplist = elementRefList.get( 'chiplist' ).current;

        if( !chiplist ) {
            return breakIndex;
        }

        if( !tabElems ) {
            tabElems = chiplist.querySelectorAll( '.aw-widgets-chip' );
        }


        let displayedRecipeChipsElems = [ ...tabElems ];
        if ( !totalVisibleArea || !visibleChipAreaMaintained ) {
            totalVisibleArea = chiplist.parentElement.parentElement ? chiplist.parentElement.parentElement.clientWidth : 0;
        }

        var totalCalculatedArea;
        if ( !totalVisibleHeight || !visibleChipAreaMaintained ) {
            totalVisibleHeight =  chiplist.parentElement.parentElement.clientHeight / 3;
        }
        let chipElementHeight = chiplist.parentElement.clientHeight;
        let clearButtonSpacing = chiplist.lastChild ? chiplist.lastChild.clientHeight : 0;
        let cmdMoreButtonSpacing = 32;
        totalCalculatedArea = clearButtonSpacing + cmdMoreButtonSpacing + chipElementHeight;

        if ( totalCalculatedArea > totalVisibleHeight ) {
            for( var i = 0; i < displayedRecipeChipsElems.length; i++ ) {
                totalCalculatedArea -= 26;
                if( totalCalculatedArea < totalVisibleHeight ) {
                    breakIndex = displayedRecipeChipsElems.length - i;
                    break;
                }
            }
        }


        displayChips = recipeChips;
        overflownChips = [];
        let chips = recipeChips;
        if ( breakIndex > 0 ) {
            overflownChips = chips.slice( breakIndex );
            displayChips = chips.slice( 0, breakIndex );
        }else if ( recipeChips.length > 7 ) {
            overflownChips = chips.slice( 7 );
            displayChips = chips.slice( 0, 7 );
        }else if ( currentOverflowChips.length > 0 && displayedRecipeChipsElems.length < recipeChips.length ) {
            overflownChips = chips.slice( displayedRecipeChipsElems.length );
            displayChips = chips.slice( 0, displayedRecipeChipsElems.length );
        }
    } else if ( currentOverflowChips.length !== 0 && displayRecipeChips.length !== 0 )  {
        overflownChips = currentOverflowChips;
        displayChips = displayRecipeChips;
    } else {
        overflownChips = [];
        displayChips = recipeChips;
    }
    let displayOverflowButton = overflownChips.length + ' ' + searchFilterCategoryExpandMore;

    return  { displayChips, overflownChips, displayOverflowButton, totalVisibleArea, totalVisibleHeight };
};

/**
 * Build master list of chips to display in filter panel
 * @param {*} recipe array of recipe terms
 * @param {*} nSelectedText n selected text
 * @returns {Object} array of chips to display
 */
export let buildRecipeChips = function( recipe ) {
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    let _nSelectedText = localTextBundle.nSelectedLabel;
    let chips = [];
    if( recipe ) {
        for( var index = 0; index < recipe.length; index++ ) {
            var parentChip = getRecipeParentChip( recipe[index], _nSelectedText, index );
            chips.push( parentChip );
        }
    }
    return chips;
};

/**
 * Update Recipe State with isClearAll flag
 * @param {*} recipeState atomic data with recipe
 */
export let clearRecipe = function( recipeState ) {
    const newRecipeState = { ...recipeState.value };
    newRecipeState.isClearAll = true;
    recipeState.update( newRecipeState );
};


/**
 * Creates the chip that will be added to the master chip list
 * @function createChip
 * @param {Object} parent If chip is a parent chip
 * @param {Object} numberOfChips if parent chip how many children chips exist
 * @param {Object} categoryName name of category
 * @param {Object} filterDisplayName display name of filter
 * @param {Object} internalCategoryName internal category name
 * @param {Object} internalFilterName internal filter name
 * @param {Object} filterType type of filter
 * @param {Object} childrenChips if parent this is children chips to display in group
 * @param {Object} recipeTerm recipe term criteria operator
 * @param {Object} recipeTermIndex recipe term index
 * @returns {Object} recipeChip
 */
function createChip( parent, numberOfChips, categoryName, filterDisplayName, internalCategoryName, internalFilterName, filterType, childrenChips, recipeTerm, recipeTermIndex ) {
    let displayLabel;
    let isFirstRecipe = recipeTermIndex === 0;
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    // Add recipe logic
    if ( numberOfChips > 1 && parent ) {
        displayLabel = categoryName + ': ' + numberOfChips + ' ' + localTextBundle.nSelectedLabel;
        internalFilterName = 'parentChip';
    } else {
        if( categoryName !== '' ) {
            displayLabel = categoryName + ': ' + filterDisplayName;
        }else if ( recipeTerm.criteriaType === 'Proximity' ) {
            displayLabel = localTextBundle.proximityTitle + ': ' + filterDisplayName;
        } else{
            displayLabel = filterDisplayName;
        }
    }


    if( isFirstRecipe && parent ) {
        displayLabel = localTextBundle.subsetRecipeOperatorFor + '  ' + displayLabel;
    } else if( !isFirstRecipe && parent ) {
        if ( recipeTerm.criteriaOperatorType === 'Exclude'  ) {
            displayLabel = localTextBundle.subsetRecipeOperatorNot + '  ' + displayLabel;
        } else if( recipeTerm.criteriaOperatorType === 'Include' ) {
            displayLabel = localTextBundle.subsetRecipeOperatorOr + '  ' + displayLabel;
        } else if ( recipeTerm.criteriaOperatorType === 'Filter' ) {
            displayLabel = localTextBundle.subsetRecipeOperatorAnd + '  ' + displayLabel;
        }
    }


    var removeRecipeIcon = 'miscRemoveBreadcrumb';
    if( isFirstRecipe && parent ) {
        removeRecipeIcon = '';
    }

    var indicatorIcon = '';
    if( recipeTerm.criteriaOperatorType === 'Include' &&  recipeTerm.criteriaValues[recipeTerm.criteriaValues.length - 1] === 'False' ) {
        indicatorIcon = 'indicatorDetection';
    }

    let recipeChip = {
        iconId: indicatorIcon,
        uiIconId: removeRecipeIcon,
        chipType: 'BUTTON',
        selected: false,
        labelDisplayName: displayLabel,
        labelInternalCategoryName: internalCategoryName,
        labelInternalFilterName: internalFilterName,
        chipFilterType: filterType,
        recipeTerm: recipeTerm,
        recipeTermIndex: recipeTermIndex,
        className: 'aw-search-breadcrumb-chip'
    };

    if ( childrenChips && childrenChips.length > 1 ) {
        recipeChip.children = childrenChips;
    }

    return recipeChip;
}

/**
 * Remove selected chip from current list of displayed or overflow chips
 * @param {*} recipeObject recipeObject
 * @param {*} chipToRemove selected chip to remove
 */
export let removeSelectedChip = function( recipeObject, chipToRemove ) {
    var subCriteriaIndex; var selectedValue;
    if ( chipToRemove.subCriteriaIndex !== undefined ) {
        subCriteriaIndex = chipToRemove.subCriteriaIndex;
        selectedValue = chipToRemove.labelDisplayName;
    }
    var existingRecipe = _.cloneDeep( recipeObject.recipe );
    var updatedRecipe = filterRecipeValidationService.updateRecipeCriteriaList( existingRecipe, chipToRemove.recipeTerm, chipToRemove.recipeTermIndex, selectedValue, subCriteriaIndex );
    eventBus.publish( 'occmgmt.recipeUpdated', {
        updatedRecipe
    } );
};

/**
 * This method will extract all the attributes from the recipe display name and return
 * them as an array.
 *
 * @param {String} recipeDisplayName : Display Name for the recipe.
 * @return {String[]} : returns an array of Strings that contain the multiple attributes
 *         in the recipe.
 */
let getAllAttrFromRecipeTerm = function( recipeDisplayName ) {
    return recipeDisplayName.split( '_$PROP_' );
};

/**
 * This method format Multi-Attribute recipe term to display on UI
 * Input string : "Logical Designator_$CAT_AAAA0*_$PROP_Name_$CAT_DE* "
 * formatted as  : "Logical Designator: AAAA0, Name: DE*
 *
 * @param {String} recipeDisplayName : Display Name for the recipe.
 * @return {String} : returns Strings for multiple attributes recipe term.
 */
let getMultiAttributeRecipeTerm = function( recipeDisplayName ) {
    var recipeDisplayString = recipeDisplayName.replace( /_\$PROP_/g, ', ' );
    recipeDisplayString = recipeDisplayString.replace( /_\$CAT_/g, ': ' );

    return recipeDisplayString;
};

/**
 * This method will extract the value for the input recipe criteria. For e.g., a
 * partition name is a value for a physical partition type.
 *
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @return {String} : The recipe value for the input recipe criteria.
 */
let getRecipeValue = function( recipeDisplayName ) {
    var value = recipeDisplayName.split( '_$CAT_' );
    return value[ 1 ];
};

/**
 * This function will extract all selected terms in the input recipe criteria and return
 * them as an array.
 *
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @return {String[]} : An array of all selected terms in the input recipe criteria.
 */
let selectedTerms = function( recipeDisplayName ) {
    var recipeValuesString = getRecipeValue( recipeDisplayName );
    var allSelectedTerms = {};
    if( recipeValuesString ) {
        allSelectedTerms = recipeValuesString.split( '^' );
    }
    return allSelectedTerms;
};

/**
 * This function will return the proximity recipe label as Within <distance><UOM> of <n> Selected
 * eg
 * input stream :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 * output       :Within 0.001 m of 2 Selected
 * @param {String}  nSelectedText : N selected text
 * @param {String}  recipeDisplayName : Recipe Criteria Display Name
 * @return {String}  proximity n selected label
 */
let getProximityNSelectedLabel = function( nSelectedText, recipeDisplayName ) {
    var temp = recipeDisplayName;
    var selections = [];
    selections = temp.split( '^' );
    var pos = recipeDisplayName.indexOf( ' ' );
    for( var i = 1; i < 4; i++ ) {
        pos = recipeDisplayName.indexOf( ' ', pos + 1 );
    }
    var initialText = recipeDisplayName.slice( 0, pos + 1 );
    return initialText + selections.length + ' ' + nSelectedText;
};

/**
 * This method will extract the Label for the input recipe criteria. For e.g., a
 * partition Scheme Name is a Label for a selected physical partition type.
 * For Proximity if isProximityTitle is true:
 *   input stream :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *   output       :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK
 *                 POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *
 * For Proximity if isProximityTitle is false:
 *      input stream :Within 0.001 m of INTERIOR CK_SmartDiscovery/A;1-INTERIOR CK^POWERTRAIN DC_SmartDiscovery/A;1-POWERTRAIN DC
 *      output       :Within 0.001 m of 2 Selected
 *
 * @param {String} recipeItem : Recipe term to display
 * @param {String} recipeDisplayName : Recipe Criteria Display Name
 * @param {Boolean} isProximityTitle Optional :Is used to implement the title/extended tooltip for proximity
 * @param {String} nSelectedText : n selected text
 * @return {String} : The recipe Label for the input recipe criteria.
 */
let getRecipeLabel = function( recipeItem, recipeDisplayName, isProximityTitle, nSelectedText ) {
    if ( recipeItem.criteriaType === 'Proximity' ) {
        if ( recipeDisplayName.indexOf( '^' ) > 0 ) {
            if( isProximityTitle ) {
                return recipeDisplayName.replace( /\^/g, ',\n' );
            }

            recipeDisplayName = getProximityNSelectedLabel( nSelectedText, recipeDisplayName );
        }
        return recipeDisplayName;
    }
    if ( recipeItem.criteriaType === 'SelectedElement' ) {
        var elementDisplayString = recipeDisplayName.split( '_$CAT_' )[0];
        if ( elementDisplayString.length === 0 ) {
            var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
            return resource.selectedElementDisplayString;
        }
    }


    return recipeDisplayName.split( '_$CAT_' )[0];
};

/**
 * Returns a parent chip to build chips for addition to the display chips array
 * @function getFilterParentChip
 * @param {Object} recipeTerm recipe term
 * @param {String} nSelectedText n selected text
 * @param {Boolean} recipeTermIndex recipe term index
 * @returns {Object} parentChip
 */
function getRecipeParentChip( recipeTerm, nSelectedText, recipeTermIndex ) {
    var childrenChips = [];
    var parent;

    //Create initial chip. If multiple of same category exist create child chip
    var numberOfChips = recipeTerm.criteriaDisplayValue.split( '_$PROP_' ).length;
    var nSelectedTerms = selectedTerms( recipeTerm.criteriaDisplayValue );
    var internalCategoryName = recipeTerm.criteriaValues[0];
    var internalFilterName = recipeTerm.criteriaValues[1];
    var filterType = recipeTerm.criteriaType;
    var recipeTermDisplayName = '';
    var categoryName = '';

    if( recipeTerm.criteriaType === 'Group' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    } else if( recipeTerm.criteriaType === 'Proximity' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue, false, nSelectedText );
    } else if ( numberOfChips > 1 && applicableCategoryTypes.includes( recipeTerm.criteriaType )  ) {
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
        recipeTermDisplayName = getMultiAttributeRecipeTerm( recipeTerm.criteriaDisplayValue );
        var allAttrFromRecipeTerm = getAllAttrFromRecipeTerm( recipeTerm.criteriaDisplayValue );
        var allAttrLabels = {};
        var allAttrValues = {};

        for( var j = 0; j < allAttrFromRecipeTerm.length; ++j ) {
            allAttrLabels[allAttrFromRecipeTerm[j]] = getRecipeLabel( recipeTerm, allAttrFromRecipeTerm[j] );
            allAttrValues[allAttrFromRecipeTerm[j]] = getRecipeValue(  allAttrFromRecipeTerm[j] );
            parent = false;

            let chipChild = createChip( parent, numberOfChips, allAttrLabels[allAttrFromRecipeTerm[j]],
                allAttrValues[allAttrFromRecipeTerm[j]], internalCategoryName, recipeTerm.criteriaValues[j + 1], filterType, null, recipeTerm, recipeTermIndex );
            childrenChips.push( chipChild );
        }
    }else if( nSelectedTerms.length > 1 ) {
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
        recipeTermDisplayName = nSelectedTerms.length +  ' '  + nSelectedText;
        for( var subCriteriaIndex = 0; subCriteriaIndex < nSelectedTerms.length; ++subCriteriaIndex ) {
            parent = false;
            let chipChild = createChip( parent, numberOfChips, '', nSelectedTerms[subCriteriaIndex], internalCategoryName, recipeTerm.criteriaValues[subCriteriaIndex + 1], filterType, null, recipeTerm, recipeTermIndex );
            chipChild.subCriteriaIndex = subCriteriaIndex;
            childrenChips.push( chipChild );
        }
    }
    parent = true;
    if( recipeTerm.criteriaType !== 'Group' && recipeTerm.criteriaType !== 'Proximity' && nSelectedTerms.length === 1 ) {
        recipeTermDisplayName = getRecipeValue( recipeTerm.criteriaDisplayValue );
        categoryName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    }
    if( recipeTermDisplayName === '' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    }
    if( recipeTermDisplayName === '' ) {
        recipeTermDisplayName = getRecipeLabel( recipeTerm, recipeTerm.criteriaDisplayValue );
    }
    return createChip( parent, numberOfChips, categoryName, recipeTermDisplayName, internalCategoryName, internalFilterName, filterType, childrenChips, recipeTerm, recipeTermIndex );
}

export default {
    buildRecipeChips,
    removeSelectedChip,
    clearRecipe,
    calculateOverflow
};
