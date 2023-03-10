/* eslint-disable complexity */
/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * @module js/discoveryFilterService
 */
import appCtxSvc from 'js/appCtxService';
import filterPanelService from 'js/filterPanelService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import cdm from 'soa/kernel/clientDataModel';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import searchFilterService from 'js/aw.searchFilter.service';
import filterPanelUtils from 'js/filterPanelUtils';
import filterPanelCommonUtils from 'js/filterPanelCommonUtils';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import createWorksetService from 'js/createWorksetService';
import searchCommonUtils from 'js/searchCommonUtils';
import proximityFilterService from 'js/proximityFilterService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import tcSessionData from 'js/TcSessionData';
import notyService from 'js/NotyModule';
import occmgmtUtils from 'js/occmgmtUtils';
import uwPropertySvc from 'js/uwPropertyService';
var exports = {};

var pciToFilterDataMap = [];
var pciToTransientRecipesMap = [];
var pciToCategoryLogicMap = [];
var _TRUE = [ 'true' ];
var applicableCategoryTypes = [ 'Attribute', 'Partition' ];
var discoveryFilterEventSubscriptions = [];
var isPartitionHierarchySupported = false;
var _resetInitiated = false;

// Event Listeners
var _onDiscoveryFilterPanelCloseListener = null;
var _productContextChangeEventListener = null;

// Product context key string
var _contextKey = null;

var gatherAllFilterValuesAcrossCategories = function( categories ) {
    var filterValues = [];
    _.forEach( categories, function( category ) {
        _.forEach( category.filterValues, function( filterValue ) {
            filterValues.push( filterValue );
        } );
    } );
    return filterValues;
};

var isFilterSelected = function( filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    if( appCtxSvc.ctx.state.params.filter ) {
        var isSelected = false;
        var appliedFilters = appCtxSvc.ctx.state.params.filter.split( '~' );
        for( var filterId = 0; filterId < appliedFilters.length; filterId++ ) {
            var categories = appliedFilters[ filterId ].split( '==' );
            if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
                isSelected = categories[ 1 ].split( filterSeparator ).includes( filterValue.internalName );
                break;
            }
        }
        return isSelected;
    }
};

var isFilterValueSameAsInputFilterString = function( filterValue, inputFilterString ) {
    return filterValue.categoryName + '^^' + filterValue.internalName === inputFilterString;
};

var removeFromFilterValuesIfItDoesNotContain = function( filterValues, filterValue, whatToCheck, orphanDateEntries ) {
    var entry = filterValues.filter( function( x ) {
        return x.categoryName === whatToCheck;
    } );
    if( !entry || !entry[ 0 ] ) {
        filterValues.splice( filterValues.indexOf( filterValue ), 1 );
        orphanDateEntries.push( filterValue );
    }
};

var removeOrphanDateEntries = function( filterValues ) {
    var orphanDateEntries = [];
    var isDateFilter = filterValues.filter( function( filter ) {
        return filter.type === filterPanelUtils.DATE_FILTER ||
              filter.type === filterPanelUtils.DATE_DRILLDOWN_FILTER;
    } );
    if( isDateFilter ) {
        for( var i = 0; i < isDateFilter.length; i++ ) {
            var tmpCategoryName = isDateFilter[ i ].categoryName.substring( 0, isDateFilter[ i ].categoryName
                .indexOf( '_0Z0_' ) );
            if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month_day' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_week', orphanDateEntries );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_year_month' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_year', orphanDateEntries );
            } else if( isDateFilter[ i ].categoryName.lastIndexOf( '_0Z0_week' ) > 0 ) {
                removeFromFilterValuesIfItDoesNotContain( filterValues, isDateFilter[ i ], tmpCategoryName +
                      '_0Z0_year_month', orphanDateEntries );
            }
        }
    }
    return orphanDateEntries;
};

var getRecipesIfItContains = function( updatedRecipes, whatToCheck, orphanDateEntries ) {
    for( var recipe in updatedRecipes ) {
        var tmpCategoryName = updatedRecipes[ recipe ].criteriaValues[ 0 ].substring( 0, updatedRecipes[ recipe ].criteriaValues[ 0 ].indexOf( '_0Z0_' ) );
        if( tmpCategoryName ) {
            for( var i = 0; i < whatToCheck.length; i++ ) {
                var orphanDate = tmpCategoryName + whatToCheck[ i ];
                if( updatedRecipes[ recipe ].criteriaValues[ 0 ].includes( orphanDate ) ) {
                    orphanDateEntries.push( updatedRecipes[ recipe ] );
                    break;
                }
            }
        }
    }
};

var getOrphanDateRecipesOnDelete = function( deletedRecipe, updatedRecipes ) {
    var orphanDateEntries = [];
    var tmpCategoryName = deletedRecipe.criteriaValues[ 0 ].substring( 0, deletedRecipe.criteriaValues[ 0 ].indexOf( '_0Z0_' ) );
    if( tmpCategoryName ) {
        var orphanDatesForYear = [ '_0Z0_year_month', '_0Z0_week', '_0Z0_year_month_day' ];
        var orphanDatesForMonth = [ '_0Z0_week', '_0Z0_year_month_day' ];
        var orphanDatesForWeek = [ '_0Z0_year_month_day' ];
        // No orphans return empty array
        if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year_month_day' ) > 0 ) {
            return orphanDateEntries;
        }
        if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year_month' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForMonth, orphanDateEntries );
        } else if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_year' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForYear, orphanDateEntries );
        } else if( deletedRecipe.criteriaValues[ 0 ].lastIndexOf( '_0Z0_week' ) > 0 ) {
            getRecipesIfItContains( updatedRecipes, orphanDatesForWeek, orphanDateEntries );
        }
    }
    return orphanDateEntries;
};

var buildEffectiveFilterString = function( filterValues ) {
    removeOrphanDateEntries( filterValues );
    return getFilterString( filterValues );
};

var getFilterString = function( filterValues ) {
    var filterStringToReturn = '';
    var previousFilterValue;
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    _.forEach( filterValues, function( filterValue ) {
        if( previousFilterValue && previousFilterValue.categoryName === filterValue.categoryName ) {
            filterStringToReturn = filterStringToReturn + filterSeparator + filterValue.internalName;
        } else {
            if( filterStringToReturn === '' ) {
                filterStringToReturn = filterStringToReturn + 'StringFilter' + '^^' + filterValue.categoryName +
                      '==' + filterValue.internalName;
            } else {
                filterStringToReturn = insertFilterString( filterStringToReturn, filterValue );
            }
        }
        previousFilterValue = filterValue;
    } );
    return filterStringToReturn;
};

var insertFilterString = function( filterStringToReturn, filterValue ) {
    //LCS-454632 Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    var appliedFilters = filterStringToReturn.split( '~' );
    var updatedFilterStringToReturn = '';
    for( var filterId = 0; filterId < appliedFilters.length; filterId++ ) {
        var foundCategory = false;
        var categories = appliedFilters[ filterId ].split( '==' );
        if( categories.length === 2 && categories[ 0 ] === 'StringFilter' + '^^' + filterValue.categoryName ) {
            foundCategory = true;
            appliedFilters[ filterId ] = appliedFilters[ filterId ] + filterSeparator + filterValue.internalName;
            break;
        }
    }
    if( foundCategory === true ) {
        for( var indx = 0; indx < appliedFilters.length; indx++ ) {
            if( _.isEmpty( updatedFilterStringToReturn ) ) {
                updatedFilterStringToReturn += appliedFilters[ indx ];
            } else {
                updatedFilterStringToReturn = updatedFilterStringToReturn + '~' + appliedFilters[ indx ];
            }
        }
    } else {
        filterStringToReturn = filterStringToReturn + '~StringFilter' + '^^' + filterValue.categoryName + '==' + filterValue.internalName;
        updatedFilterStringToReturn = filterStringToReturn;
    }
    return updatedFilterStringToReturn;
};

var lookupCategoriesInfoInCache = function( productContextInfoUID ) {
    var filterData;
    var categories;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        categories = filterData[ 0 ].categories;
    }
    return categories;
};

var updateCtxRecipeInfoFromCache = function( productContextInfoUID ) {
    var filterData;
    var recipe;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        recipe = _.cloneDeep( filterData[ 0 ].recipe );
        if( recipe ) {
            occmgmtUtils.updateValueOnCtxOrState( 'recipe', recipe, _contextKey );
        }
    }
};

var getEffectiveFilterStringFromRecipe = function( updatedRecipe ) {
    var effectiveFilterValuesToConsider = getFilterMapFromRecipes( updatedRecipe, false );
    return buildEffectiveFilterString( effectiveFilterValuesToConsider );
};

var getFilterMapFromRecipes = function( recipes, validateToIncludeInputFilter, filterString ) {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
    var categories = lookupCategoriesInfoInCache( productContextInfoUID );
    var filterValues = gatherAllFilterValuesAcrossCategories( categories );
    var effectiveFilterValuesToConsider = [];

    _.forEach( recipes, function( recipe ) {
        if( applicableCategoryTypes.includes( recipe.criteriaType ) && recipe.criteriaOperatorType !== 'Clear' ) {
            var recipeFoundInMap = false;
            var recipeCategory = recipe.criteriaValues[ 0 ];
            var recipeFilterValue = recipe.criteriaValues[ 1 ];
            _.forEach( filterValues, function( filterValue ) {
                var filterCategory = filterValue.categoryName;
                var value = filterValue.internalName;
                if( recipeCategory === filterCategory && recipeFilterValue === value && isFilterSelected( filterValue ) ) {
                    recipeFoundInMap = true;
                    if( validateToIncludeInputFilter ) {
                        if( !isFilterValueSameAsInputFilterString( filterValue, filterString ) ) {
                            effectiveFilterValuesToConsider.push( filterValue );
                        }
                    } else {
                        effectiveFilterValuesToConsider.push( filterValue );
                    }
                }
            } );
            if( !recipeFoundInMap ) {
                var filterValue = {};
                filterValue.categoryName = recipe.criteriaValues[ 0 ];
                filterValue.internalName = recipe.criteriaValues[ 1 ];
                filterValue.name = recipe.criteriaValues[ 1 ];
                filterValue.type = 'StringFilter';
                filterValue.selected = true;
                effectiveFilterValuesToConsider.push( filterValue );
            }
        }
    } );

    return effectiveFilterValuesToConsider;
};


var updateCategoriesInfoCacheForCurrentPCI = function( categories, rawCategories, rawCategoryValues, recipe ) {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var pciUID = occMgmtCtx.productContextInfo.uid;
    var pciVsFilterInfoEntry = {};
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        var filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );
        if( filterData && filterData[ 0 ] ) {
            filterData[ 0 ].recipe = recipe;
            filterData[ 0 ].categories = categories;
            filterData[ 0 ].rawCategories = rawCategories;
            filterData[ 0 ].rawCategoryValues = rawCategoryValues;
        } else {
            pciVsFilterInfoEntry = {
                pciUid: pciUID,
                recipe: recipe,
                categories: categories,
                rawCategories: rawCategories,
                rawCategoryValues: rawCategoryValues
            };
            pciToFilterDataMap.push( pciVsFilterInfoEntry );
        }
    } else {
        pciVsFilterInfoEntry = { // eslint-disable-line no-redeclare
            pciUid: pciUID,
            recipe: recipe,
            categories: categories,
            rawCategories: rawCategories,
            rawCategoryValues: rawCategoryValues
        };
        pciToFilterDataMap.push( pciVsFilterInfoEntry );
    }
};

var gatherSelectedFilterValues = function( filterValues ) {
    var selectedFilterValue = [];
    _.forEach( filterValues, function( filterValue ) {
        if( filterValue.selected ) {
            selectedFilterValue.push( filterValue );
        }
    } );
    return selectedFilterValue;
};

export let computeFilterStringForNewProductContextInfo = function( newProductContextInfoUID ) {
    var filterString = '';
    var categories = lookupCategoriesInfoInCache( newProductContextInfoUID );
    if( categories ) {
        var filterValues = gatherAllFilterValuesAcrossCategories( categories );
        var selectedFilterValues = gatherSelectedFilterValues( filterValues );
        filterString = buildEffectiveFilterString( selectedFilterValues );
    }
    return filterString;
};

var clearCache = function() {
    pciToFilterDataMap = [];
};

export let clearRecipeCache = function( subPanelContext, clearAll ) {
    if( clearAll ) {
        pciToTransientRecipesMap = [];
    } else {
        // Get the current PCI and only clear the cache for that
        // Get the active PCI from data from the view model, only take funtion argument PCI if data is not present.
        var activePCIUID = appCtxSvc.getCtx( _contextKey ).productContextInfo.uid;
        var recipeData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === activePCIUID;
        } );
        if( recipeData && recipeData.length > 0 ) {
            pciToTransientRecipesMap.splice( pciToTransientRecipesMap.indexOf( recipeData ), 1 );
        }
    }

    if( subPanelContext ) {
        const newSharedData = { ...subPanelContext.sharedData.getValue() };
        if( _.isUndefined( newSharedData.enableFilterApply ) || newSharedData.enableFilterApply ) {
            // modify shared data only if required
            newSharedData.enableFilterApply = false;
            subPanelContext.sharedData.update && subPanelContext.sharedData.update( newSharedData );
        }
    }
};

export let clearCategoryLogicMap = function() {
    var activePCI = appCtxSvc.getCtx( _contextKey ).productContextInfo.uid;
    var recipeData = pciToCategoryLogicMap.filter( function( x ) {
        return x.pciUid === activePCI;
    } );
    if( recipeData && recipeData.length > 0 ) {
        pciToCategoryLogicMap.splice( pciToCategoryLogicMap.indexOf( recipeData ), 1 );
    }
};

var clearFilterInfoFromURL = function() {
    let filterOnUrl = appCtxSvc.getCtx( _contextKey ).filter;
    if( filterOnUrl && filterOnUrl !== null ) {
        contextStateMgmtService.syncContextState( _contextKey, {
            filter: null
        } );
    }
};

var clearRecipeFromContext = function() {
    var occContext = appCtxSvc.getCtx( _contextKey );
    if( occContext ) {
        occmgmtUtils.updateValueOnCtxOrState( 'recipe', [], _contextKey );
    }
};


var getRawCategoriesAndCategoryValues = function( pci ) {
    var filterData;
    if( pciToFilterDataMap && pciToFilterDataMap.length > 0 ) {
        filterData = pciToFilterDataMap.filter( function( x ) {
            return x.pciUid === pci;
        } );
    }
    if( filterData && filterData[ 0 ] ) {
        return {
            recipe: filterData[ 0 ].recipe,
            rawCategories: filterData[ 0 ].rawCategories,
            rawCategoryValues: filterData[ 0 ].rawCategoryValues
        };
    }
};

var getCategoriesWithUpdatedCategoryLogicAfterFilterChange = function( categories, recipe ) {
    // Hide category logic when no recipe or the category for 1st recipe term or for Date type category if first term is from that category
    let modifiedCategories = categories;
    if( recipe && recipe.length > 0 ) {
        for( var index in modifiedCategories ) {
            if( modifiedCategories[ index ].internalName === recipe[ 0 ].criteriaValues[ 0 ] && modifiedCategories[ index ].categoryType !== 'Spatial' ||
                  modifiedCategories[ index ].type === 'DateFilter' && recipe[ 0 ].criteriaValues[ 0 ].indexOf( modifiedCategories[ index ].internalName ) > -1 ) {
                modifiedCategories[ index ].isExcludeCategorySupported = false;
            }
        }
    } else {
        // Also hide the category logic toggle when no recipe
        for( var i in modifiedCategories ) {
            modifiedCategories[ i ].isExcludeCategorySupported = false;
        }
    }

    return modifiedCategories;
};

var updateCategoryLogicMapInCache = function( newCategoryLogicMap ) {
    var occContext = appCtxSvc.getCtx( _contextKey );
    var pciUID = occContext.productContextInfo.uid;
    // Update the cache with appropriate entry for category logic
    var pciToCategoryLogicEntry;
    if( pciToCategoryLogicMap && pciToCategoryLogicMap.length > 0 ) {
        var categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );

        if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
            // Update existing entry for category logic cache
            categoryLogicEntry[ 0 ].categoryLogicMap = newCategoryLogicMap;
        } else {
            pciToCategoryLogicEntry = {
                pciUid: pciUID,
                categoryLogicMap: newCategoryLogicMap
            };
            // Add new entry for the active PCI to cache
            pciToCategoryLogicMap.push( pciToCategoryLogicEntry );
        }
    } else {
        pciToCategoryLogicEntry = {
            pciUid: pciUID,
            categoryLogicMap: newCategoryLogicMap
        };
        pciToCategoryLogicMap.push( pciToCategoryLogicEntry );
    }
};

var initializeCategoryLogicCache = function( categories, recipe, categoryLogicMap ) {
    if( !isTCVersion132OrLater() ) {
        return;
    }
    var newCategoryLogicMap = {};
    if( recipe && recipe.length > 0 ) {
        // Case:  There is recipe applied then we need to iterate over recipe terms
        // and look for NOT logic on in recipes for categories and update the category logic map
        for( var index in categories ) {
            if( !categoryLogicMap ) {
                var categoryLogic = true;
                if( categories[ index ].categoryType !== 'Spatial' ) {
                    var recipeTermList = getRecipeForCategory( recipe, categories[ index ] );
                    for( var j in recipeTermList ) {
                        if( recipeTermList[ j ].criteriaOperatorType === 'Exclude' ) {
                            categoryLogic = false; //  logic is false implying 'Exclude'
                            break;
                        }
                    }
                }
                newCategoryLogicMap[ categories[ index ].displayName ] = categoryLogic;
                categories[ index ].excludeCategory = !categoryLogic;
            } else {
                categories[ index ].excludeCategory = !categoryLogicMap[ categories[ index ].displayName ];
            }

            // Hide category logic when the category for 1st recipe term or for Date type category if first term is from that category
            if( categories[ index ].internalName === recipe[ 0 ].criteriaValues[ 0 ] && categories[ index ].categoryType !== 'Spatial' ||
                  categories[ index ].type === 'DateFilter' && recipe[ 0 ].criteriaValues[ 0 ].indexOf( categories[ index ].internalName ) > -1 ) {
                categories[ index ].isExcludeCategorySupported = false;
            }
        }
    } else {
        // Case: No filter/recipe applied, we initialize logic to false (i.e. Filter)
        for( var i in categories ) {
            if( !categoryLogicMap ) {
                newCategoryLogicMap[ categories[ i ].displayName ] = true; // default logic is true implying 'Filter'
                categories[ i ].excludeCategory = false;
            } else {
                categories[ i ].excludeCategory = !categoryLogicMap[ categories[ i ].displayName ];
            }
            // Also hide the category logic toggle when no recipe
            categories[ i ].isExcludeCategorySupported = false;
        }
    }

    if( !categoryLogicMap ) {
        updateCategoryLogicMapInCache( newCategoryLogicMap );
    }
    return categories;
};

export let toggleCategoryLogic = function( toggleCategory, excludeCategoryToggleValue, updateAtomicData, searchState, recipeState, sharedData, occContext  ) {
    // Create transient recipe if there are no recipes in transient map
    cloneCurrentRecipesIfNeeded();


    let categoryLogicMap = {};
    var occmgmtContext = appCtxSvc.getCtx( _contextKey );
    var pciUID = occmgmtContext.productContextInfo.uid;
    var categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
        return x.pciUid === pciUID;
    } );

    if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
        // Update existing entry for category logic cache
        categoryLogicMap = categoryLogicEntry[ 0 ].categoryLogicMap;
    }

    // true implies category is toggled to NOT
    // false implies category is not toggled to NOT(i.e. AND/Filter)
    categoryLogicMap[ toggleCategory.displayName ] = !categoryLogicMap[ toggleCategory.displayName ];
    categoryLogicEntry[ 0 ].categoryLogicMap = categoryLogicMap;

    if( toggleCategory.categoryType === 'Spatial' ) {
        // Update search state
        updateSearchStateExcludeCategory( searchState, toggleCategory, excludeCategoryToggleValue, updateAtomicData );
        // Do not update existing recipe term for Spatial category
        return;
    }

    // Update recipe operator and recipes cache
    var recipesData = pciToTransientRecipesMap.filter( function( x ) {
        return x.pciUid === pciUID;
    } );

    var displayRecipe = recipeState.recipe;
    if( recipesData && recipesData[ 0 ] ) {
        var recipeTermInTransientList = getRecipeForCategory( recipesData[ 0 ].transientRecipes, toggleCategory );
        var displayRecipeTermList = getRecipeForCategory( displayRecipe, toggleCategory );
        if( recipeTermInTransientList && recipeTermInTransientList.length > 0 ) {
            if( categoryLogicMap[ toggleCategory.displayName ] ) {
                _.forEach( recipeTermInTransientList, function( recipeTermInTransient ) {
                    // Update Transient list recipe term
                    recipeTermInTransient.criteriaOperatorType = 'Filter';
                } );

                _.forEach( displayRecipeTermList, function( displayRecipeTerm ) {
                    // Update recipe list used to display in view
                    displayRecipeTerm.criteriaOperatorType = 'Filter';
                } );
            } else {
                _.forEach( recipeTermInTransientList, function( recipeTermInTransient ) {
                    // Update Transient list recipe term
                    recipeTermInTransient.criteriaOperatorType = 'Exclude';
                } );

                _.forEach( displayRecipeTermList, function( displayRecipeTerm ) {
                    // Update recipe list used to display in view
                    displayRecipeTerm.criteriaOperatorType = 'Exclude';
                } );
            }

            if( sharedData.autoApply ) {
                // Trigger SOA call to apply filter/recipe
                applyFilter( displayRecipe, occContext );
                return;
            }

            // Enable Filter button if recipe has changed
            var currentRecipes = _.clone( occmgmtContext.recipe );

            var shouldEnableApply = areRecipesChanged( currentRecipes, recipesData[ 0 ].transientRecipes );
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = shouldEnableApply;
            sharedData.update && sharedData.update( newSharedData );
            // Update recipe on context
            updateRecipeOnContext( recipesData[ 0 ].transientRecipes );

            // Update recipe state
            var updateRecipeStateAtomicData = updateAtomicData.recipeState;
            updateRecipeStateAtomicData( { ...recipeState, recipe: displayRecipe } );
        }
    }
    // Update search state
    updateSearchStateExcludeCategory( searchState, toggleCategory, categoryLogicMap[ toggleCategory.displayName ], updateAtomicData );
};

export const updateSearchStateExcludeCategory = ( searchState, toggleCategory, excludeCategoryToggleValue, updateAtomicData ) => {
    let newSearchState = { ...searchState };
    let updatedCategories = newSearchState.categories.map( ( cat ) => {
        if( cat.internalName === toggleCategory.internalName ) {
            let updatedCategory = { ...cat };
            updatedCategory.excludeCategory = !excludeCategoryToggleValue;
            return updatedCategory;
        }
        return cat;
    } );

    var updateSearchStateAtomicData = updateAtomicData.searchState;
    updateSearchStateAtomicData( { ...newSearchState, categories: updatedCategories } );
};

/**
    * Update recipe on context
    * @param {Object} transientRecipe recipe list to update
    */
var updateRecipeOnContext = function( transientRecipe ) {
    var newRecipe = [];
    _.forEach( transientRecipe, function( recipeTerm ) {
        newRecipe.push( recipeTerm );
    } );

    var effectiveFilterString = getEffectiveFilterStringFromRecipe( newRecipe );
    var value = {
        effectiveFilterString: effectiveFilterString,
        effectiveRecipe: newRecipe
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
};

/**
       * Find recipe for given category
       * @param {Object} recipe recipe
       * @param {Object} category selected category
       * @return {Object} Recipe list
   */
var getRecipeForCategory = function( recipe, category ) {
    var existingRecipeTermList = [];
    _.forEach( recipe, function( recipeTerm ) {
        if( recipeTerm.criteriaValues[ 0 ] === category.internalName ) {
            existingRecipeTermList.push( recipeTerm );
        } else if( category.type === 'DateFilter' ) {
            _.forEach( category.filterValues, function( filterValue ) {
                if( recipeTerm.criteriaValues[ 0 ] === filterValue.categoryName ) {
                    existingRecipeTermList.push( recipeTerm );
                }
            } );
        }
    } );
    return existingRecipeTermList;
};

let processCategoryMetaData = function( categoryToProcess, processCategories, isIndexed ) {
    if( processCategories && applicableCategoryTypes.includes( categoryToProcess.categoryType ) && categoryToProcess.filterValues.length === 0 ) {
        // Show the expansion twisty on the filter category widget.
        categoryToProcess.showExpand = true;

        //The Text Search widget within filter categories relies on this variable to make
        // to decide whether to make a performFacetSearch or not. Setting this to true
        // allows the widget to performFacetSearch if a textsearch box is present in he UI.
        categoryToProcess.isServerSearch = true;

        // This flag will set the filter category to be rendered as collapsed.
        categoryToProcess.expand = false;
    } else if( processCategories && filterPanelUtils.ifFilterSelectedForCategory( categoryToProcess ) ) {
        categoryToProcess.expand = true;
    }
    if( processCategories ) {
        categoryToProcess.isExcludeCategorySupported = true;
    }

    if( isIndexed ) {
        for( var index = 0; index < categoryToProcess.filterValues.length; index++ ) {
            categoryToProcess.filterValues[ index ].showColor = false;
        }
    }
};

let processCategoriesMetaDataForRendering = function( soaResponseFilterValues, processedCategories, processCategories ) {
    var isIndexed = isDiscoveryIndexed();

    for( var i = 0; i < processedCategories.length; i++ ) {
        // Special processing for the Filter Categories for which no filter values were returned.
        // In such cases we plan to keep the category collapsed. For performance reasons, the server
        // does not return filter values for Filter categories based on Occurrence Properties, as part
        // of getSubsetInfo SOA service call.

        processCategoryMetaData( processedCategories[ i ], processCategories, isIndexed );
        updatePartitionCategory2( processedCategories[ i ], soaResponseFilterValues[ processedCategories[ i ].internalName ], processCategories );
    }
};


/**
      TODO-updatePartitionCategory [skpnw0]: hasChildren attribute is missing in performFacetSearch SOA output structure.
      For now, considering time crunch we can use alternate attribute like startEndRange to populate child Icon.
      We agreed this is stop gap solution and we should have Story to change SOA output structure and delete this stop gap solution
      */
let updatePartitionCategory2 = ( category, soaPartitionFilterValues, processCategories ) => {
    if( category.categoryType === 'Partition' ) {
        var updatedFilterValues = [];
        _.forEach( soaPartitionFilterValues, function( soaFilterValue ) {
            category.filterValues.filter( function( filterValue ) {
                if( soaFilterValue.stringValue === filterValue.internalName ) {
                    if( soaFilterValue.stringValue === filterValue.internalName && soaFilterValue.startEndRange !== 'undefined' &&
                          soaFilterValue.startEndRange === 'true' || soaFilterValue.hasChildren !== 'undefined' && soaFilterValue.hasChildren ) {
                        filterValue.suffixIconId = 'indicatorChildren';
                        filterValue.showSuffixIcon = true;
                    }
                    updatedFilterValues.push( filterValue );
                }
            } );
        } );

        if( isPartitionHierarchySupported ) {
            category.type = 'PartitionFilter';
        }
        category.filterValues = updatedFilterValues;
        category.results = _.slice( category.filterValues, 0, category.numberOfFiltersShown );
        category.showFilterText = true;
        category.isServerSearch = true;
        var areMembersSelected = category.filterValues.filter( function( filterValue ) {
            return filterValue.selected.dbValue === true;
        } ).length > 0;
        category.expand = areMembersSelected ? category.expand : processCategories ? false : category.expand;
    }
};

/**
  * This method is to do post processing after getOcc* SOA call is done. This includes clearing temp variables in ctx and publish
  * event for VIS to notify recipe update.
  * @param {Object} occContext ace atomic data
  */
export let performPostProcessingOnLoad = function( occContext ) {
    //process recipe only when recipe is updated( via filters apply or recipe term change )
    let autoSaveEnabled = createWorksetService.isAutoSaveWorksetEnabled( _contextKey );
    let occContextVal = occContext.getValue();
    if( occContextVal.updatedRecipe || appCtxSvc.ctx[ _contextKey ].contentRemoved === true ) {
        //Publish the event so that any views that are interested when the PWA contents are updated
        //due to filter/recipe change update as necessary. Currently, this will be used by 3D Viewer.
        //This event must not be published in case of Workset or AppSession in Workset in 14.2 where
        //update of 3DViewer(SWA tabs) is performed based on reloadDependentTabs requestPref in getOcc
        //SOA response
        if ( !autoSaveEnabled ) {
            eventBus.publish( 'primaryWorkArea.contentsReloaded', {
                viewToReact: _contextKey
            } );
        }
        _removeTempRecipeObjFromAppCtx( occContext );
    }
};

/**
  * This method is to post process the occgmmtContext object and remove the updatedRecipe and appliedFilters
  * objects from there. These are temp variables created only to hold the changes for creating the SOA input.
  * @param {Object} occContext occContext object
  */
function _removeTempRecipeObjFromAppCtx( occContext ) {
    let occContextVal = occContext.getValue();
    if( occContextVal.updatedRecipe ) {
        let value = {
            updatedRecipe: undefined
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    }

    if( appCtxSvc.ctx[ _contextKey ].effectiveFilterString ||  appCtxSvc.ctx[ _contextKey ].effectiveRecipe ) {
        var value = {
            effectiveFilterString: undefined,
            effectiveRecipe: undefined
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
    }
}

let updateFilterInfo = function( searchState, soaResponseCategories, soaResponseFilterMap, recipe, processCategories ) {
    if( soaResponseCategories === undefined || soaResponseCategories.length === 0 ) {
        return;
    }
    const newSearchData = { ...searchState };
    newSearchData.searchFilterCategories =  _.cloneDeep( soaResponseCategories );
    newSearchData.searchFilterMap = _.cloneDeep( soaResponseFilterMap );
    newSearchData.bulkFiltersApplied = false;
    var processedCategories = filterPanelService.getCategories3( newSearchData, false ); // false for not showing date/numeric range

    _.forEach( processedCategories, function( category, index ) {
        var responseCategory = _.find( soaResponseCategories, function( cat ) {
            if( processedCategories[ index ].internalName === cat.internalName ) {
                return cat;
            }
        } );
        if( responseCategory ) {
            processedCategories[ index ].hasMoreFacetValues = !responseCategory.endReached;
            processedCategories[ index ].isServerSearch = !responseCategory.endReached;
            processedCategories[ index ].startIndexForFacetSearch = responseCategory.endIndex;
        }

        if( category.categoryType === 'Spatial' ) {
            processedCategories[ index ].type = 'SpatialFilter';
        }
        if( category.categoryType === 'Partition' && isPartitionHierarchySupported ) {
            processedCategories[ index ].type = 'PartitionFilter';
        }
    } );
    processCategoriesMetaDataForRendering( soaResponseFilterMap, processedCategories, processCategories );
    if( processCategories ) {
        initializeCategoryLogicCache( processedCategories, recipe );
    }
    newSearchData.categories = processedCategories;

    const selectedFiltersMap = getSelectedFiltersMap( newSearchData.categories );
    newSearchData.filterString = searchFilterService.buildFilterString( selectedFiltersMap );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
    newSearchData.appliedFilterMap = selectedFiltersInfo.activeFilterMap;

    // TODO: This should be done in initialize method
    clearFilterInfoFromURL();

    // Update categories cache from SOA response
    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( newSearchData.categories ), soaResponseCategories, soaResponseFilterMap, recipe );

    return newSearchData;
};

/**
   * persistCategoryFilterToUpdateState
   * @param {Object} context event data object
   */
export let persistCategoryFilterToUpdateState = function( context ) {
    // Persist the values on the search context. This will be used later to merge the filter values
    // This function is called when More... is clicked and before the SOA call is made.
    // Update the category(activeFilter) and the current filter values for that category (searchFilterMap
    // on the search context. These values are used while processing the SOA response to append the response
    // filter values with the exising filter values.
    var contextSearchCtx = appCtxSvc.getCtx( 'search' );
    contextSearchCtx.activeFilter = context.category;
    contextSearchCtx.searchFilterMap = {};

    var rawCategories = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    var filterValues = rawCategories.rawCategoryValues;
    for( var filter in filterValues ) {
        if( filter === context.category.internalName ) {
            contextSearchCtx.searchFilterMap[ filter ] = filterValues[ filter ];
            break;
        }
    }
};

const removeSelectedField = ( filterValues ) => {
    let updateFilterValues = [];
    if( filterValues && filterValues.length > 0 ) {
        for( let index = 0; index < filterValues.length; index++ ) {
            let eachFilterValue = { ...filterValues[ index ].value };
            eachFilterValue.selected = eachFilterValue.selected && eachFilterValue.selected.dbValue ? eachFilterValue.selected.dbValue : false;
            updateFilterValues.push( eachFilterValue );
        }
    }
    return updateFilterValues;
};

/**
       * This function is to process the performFacetSearch SOA response.
       * It is called when More... is clicked and on search within the facet.
       *
       * @param {Object} response SOA response of performFacetSearch SOA
       * @param {Object} searchState search state for view
       * @param {Object} searchStateUpdater search state updater
       * @param {Object} categoryForFacetSearchInput search input  category info for SOA
       * @param {Object} category face category

       */
export let updateCategoriesAfterFacetSearch = function( response, searchState, searchStateUpdater, categoryForFacetSearchInput, category ) {
    let updateSearchStateAtomicData = searchStateUpdater.searchState;
    category.filterValues = removeSelectedField( category.filterValues );
    let modifiedSearchFilterMap = searchState.searchFilterMap;
    let soaResponseFilterValues;
    if( response.searchFilterMap ) {
        soaResponseFilterValues = response.searchFilterMap[ category.internalName ];
        modifiedSearchFilterMap = AwFilterPanelUtils.setMapForFilterValueSearch( response.searchFilterMap,
            searchState, category, categoryForFacetSearchInput.startIndex );
        category.filterValues = filterPanelService.getFiltersForCategory( category,
            searchState.searchFilterMap, undefined, searchState.colorToggle );
    }

    category.hasMoreFacetValues = response.hasMoreFacetValues;
    if( !category.isServerSearch && category.hasMoreFacetValues ) {
        category.isServerSearch = true;
    }
    category.numberOfFiltersShown = category.filterValues.length;
    category.expand = true;
    let modifiedCategoriesExpandCollapseMap = AwFilterPanelUtils.setCategoryExpandCollapseStateInSearchState( searchState.categoriesExpandCollapseMap, category.internalName, category.expand );
    category.isPopulated = Boolean( category.filterValues && ( _.isArray( category.filterValues ) && category.filterValues.length > 0 ||
          !_.isArray( category.filterValues ) ) );
    category.updateNumberOfFiltersShown = categoryForFacetSearchInput.startIndex > 0;
    processCategoryMetaData( category, false, isDiscoveryIndexed() );
    updatePartitionCategory2( category, soaResponseFilterValues, false );
    category = filterPanelCommonUtils.processFilterCategories( false, category, modifiedSearchFilterMap );

    if( category.type === 'StringFilter' ) {
        category.facetSearchString = categoryForFacetSearchInput.facetSearchString;
        category.showFilterText =
              category.filterValues &&
              category.filterValues.length > category.defaultFilterValueDisplayCount * 2 ||
              categoryForFacetSearchInput.isServerSearch;
    }

    // Update categories in search state
    let categories = searchState.categories;
    for( let index = 0; index < categories.length; index++ ) {
        if( category.internalName === categories[ index ].internalName ) {
            categories[ index ] = category;
            break;
        }
    }

    // Update the local cache with updated merged filter values
    var updatedFilterValues = [];
    if( Object.keys( searchState.searchFilterMap ).includes( category.internalName ) ) {
        updatedFilterValues = searchState.searchFilterMap[ category.internalName ];
    }
    if( !searchState.autoApplyFilters ) {
        syncFiltersInCacheOnFacetSearch( updatedFilterValues, category.internalName, categoryForFacetSearchInput.facetSearchString );
    }

    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    rawCategoriesInfo.rawCategoryValues[ category.internalName ] = updatedFilterValues;
    var rawCategories = rawCategoriesInfo.rawCategories;
    for( var rawCategory in rawCategories ) {
        if( rawCategories[ rawCategory ].internalName === category.internalName ) {
            rawCategories[ rawCategory ].hasMoreFacetValues = response.hasMoreFacetValues;
            rawCategories[ rawCategory ].endReached = !response.hasMoreFacetValues;
            rawCategories[ rawCategory ].startIndexForFacetSearch = response.endIndex;
            rawCategories[ rawCategory ].endIndex = response.endIndex;
            break;
        }
    }

    updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( categories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );

    // Update search state
    updateSearchStateAtomicData( {
        ...searchState,
        isFacetSearch: true,
        categories: categories,
        categoriesExpandCollapseMap: modifiedCategoriesExpandCollapseMap,
        searchFilterMap: modifiedSearchFilterMap
    } );
};

export let updatePartitionSchemeFacet = function( searchState, searchStateUpdater, categoryForFacetSearchInput, category ) {
    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    var rawFilterValues = rawCategoriesInfo.rawCategoryValues[ category.internalName ];
    let modifiedSearchFilterMap = searchState.searchFilterMap;
    let updateSearchStateAtomicData = searchStateUpdater.searchState;

    category.filterValues = filterPanelService.getFiltersForCategory( category,
        searchState.searchFilterMap, undefined, searchState.colorToggle );

    category.numberOfFiltersShown = category.filterValues.length;
    category.expand = true;
    let modifiedCategoriesExpandCollapseMap = AwFilterPanelUtils.setCategoryExpandCollapseStateInSearchState( searchState.categoriesExpandCollapseMap, category.internalName, category.expand );
    category.isPopulated = Boolean( category.filterValues && ( _.isArray( category.filterValues ) && category.filterValues.length > 0 ||
          !_.isArray( category.filterValues ) ) );
    category.updateNumberOfFiltersShown = categoryForFacetSearchInput.startIndex > 0;
    processCategoryMetaData( category, false, isDiscoveryIndexed() );
    updatePartitionCategory2( category, rawFilterValues, false );
    category.facetSearchString = categoryForFacetSearchInput.facetSearchString;
    category.showFilterText = category.filterValues && category.filterValues.length > category.defaultFilterValueDisplayCount * 2 || categoryForFacetSearchInput.isServerSearch;

    // Update categories in search state
    let categories = searchState.categories;
    for( let index = 0; index < categories.length; index++ ) {
        if( category.internalName === categories[ index ].internalName ) {
            categories[ index ] = category;
            break;
        }
    }

    // Update the local cache with updated merged filter values
    var updatedFilterValues = searchState.searchFilterMap[ category.internalName ];

    rawCategoriesInfo.rawCategoryValues[ category.internalName ] = updatedFilterValues;
    var rawCategories = rawCategoriesInfo.rawCategories;
    for( var rawCategory in rawCategories ) {
        if( rawCategories[ rawCategory ].internalName === category.internalName ) {
            rawCategories[ rawCategory ].hasMoreFacetValues = category.hasMoreFacetValues;
            rawCategories[ rawCategory ].endReached = !category.hasMoreFacetValues;
            rawCategories[ rawCategory ].startIndexForFacetSearch = category.endIndex;
            rawCategories[ rawCategory ].endIndex = category.endIndex;
        }
    }

    updateCategoriesInfoCacheForCurrentPCI( categories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );

    // Update search state
    searchState.isFacetSearch = true;
    updateSearchStateAtomicData( { ...searchState, categories: categories, categoriesExpandCollapseMap: modifiedCategoriesExpandCollapseMap, searchFilterMap: modifiedSearchFilterMap } );
};

var revalidateIncludeExcludeCommandVisibility = function( recipe ) {
    if( recipe && recipe.length === 1 ) {
        // Re-evaluate validity of Include/Exclude commands
        // when first recipe term is added
        var validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
        validateTermsToIncludeOrExclude( validSelectedObjects );
    } else if( recipe && recipe.length === 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', false, 'filter' );
    }
};

export let applyFilterInBulkMode = function( updateAtomicData, occContext ) {
    var effectiveRecipe = appCtxSvc.ctx[ _contextKey ].effectiveRecipe;
    let updateSearchStateAtomicData = updateAtomicData.searchState;
    let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
    updateSearchStateAtomicData( newSearchState );
    exports.applyFilter( effectiveRecipe, occContext );
};

var applyFilter = function( recipe, occContext ) {
    // In case of autosave workset, we need to make sure that we add a callback function
    // to occContext to allow for ACE framework to use our provide mechanism for partial
    // error processing, This is required due to possibility of concurrent updates in workset
    if( createWorksetService.isAutoSaveWorksetEnabled( _contextKey ) ) {
        eventBus.publish( 'workset.overridePartialErrorProcessing' );
    }

    // NOTE: Due to pack/unpack feature in smart discovery products, when we first filter
    // an assembly, the server unpacks the filtered assembly by default. Due to this, the
    // newly generated PCI is different from previously present. The new PCI does not have
    // PA:1 in it. So we need to remove any entry for this now stale PCI from our map.
    clearRecipeCache( undefined, false );
    // END of above explanation.
    clearCategoryLogicMap();

    let occContextValue;
    if( occContext.currentState && occContext.currentState.incontext_uid && occContext.currentState.incontext_uid !== null ) {
        var contextState = contextStateMgmtService.createContextState( occContext, {
            incontext_uid: null
        }, true );
        occContextValue = {
            transientRequestPref: {
                calculateFilters: true,
                retainTreeExpansionStates: true, // Retain expansion state on application of filter
                filterOrRecipeChange: true,
                jitterFreePropLoad: true
            },
            updatedRecipe: recipe,
            currentState: contextState.currentState,
            previousState: contextState.previousState,
            clearExistingSelections: true,
            pwaReset: true
        };
    }else{
        occContextValue = {
            transientRequestPref: {
                calculateFilters: true,
                retainTreeExpansionStates: true, // Retain expansion state on application of filter
                filterOrRecipeChange: true,
                jitterFreePropLoad: true
            },
            updatedRecipe: recipe,
            clearExistingSelections: true,
            pwaReset: true
        };
    }

    // Update transient request pref and set reset flag on context

    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    // Fire event to trigger server visibility re-evaluation on filter change
    eventBus.publish( 'cdm.updated', { updatedObjects: [ occContext.selectedModelObjects[0] ] } );
};

/**
   * Create an Recipe for a selected filter value
   * @param {Object} category - Filter category object of the selected filter value.
   * @param {object} filter - Selected filter value.
   * @param {object} recipes - The existing recipes.
   * @return {object} Criteria recipe
   */
var createRecipeForGivenCategory = function( category, filter, recipes ) {
    var criteriaVal = [];
    var recipeOperator = appCtxSvc.ctx[ _contextKey ].recipeOperator;
    var recipeExists;
    // TODO : in AW5.2 Partitions are shown as Psuedo Hierachy by appending "- " in front
    // To Populate Recipe We need Only its display name, so replacing "- " pattern from start of filter name to ''
    // This needs to be cleaned up once Partitions are showned using aw-tree widget.
    var displayFilterValue = filter.name.replace( new RegExp( '^(\- )*', 'g' ), '' );
    if( isTCVersion132OrLater() ) {
        var occContext = appCtxSvc.getCtx( _contextKey );
        var pciUID = occContext.productContextInfo.uid;
        var categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );
        if( categoryLogicEntry && categoryLogicEntry.length > 0 ) {
            if( categoryLogicEntry[ 0 ].categoryLogicMap[ category.displayName ] ) {
                recipeOperator = 'Exclude';
            }
        }
        recipeExists = getRecipeForExistingCategory( recipes, filter );

        if( recipeExists ) {
            var recipe = _.cloneDeep( recipeExists );
            // Get the filter separator value from the preference AW_FacetValue_Separator
            var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
            recipe.criteriaValues.push( filter.internalName );
            recipe.criteriaDisplayValue += filterSeparator + displayFilterValue;

            return recipe;
        }
    }
    if( !recipeExists ) {
        criteriaVal.push( filter.categoryName );
        criteriaVal.push( filter.internalName );
        return {
            criteriaDisplayValue: category.displayName + '_$CAT_' + displayFilterValue,
            criteriaOperatorType: recipeOperator,
            criteriaType: category.categoryType,
            criteriaValues: criteriaVal,
            subCriteria: []
        };
    }
};

/**
   * Create an Recipe for a selected filter value
   * @param {Object} category - Filter category object of the selected filter value.
   * @param {object} filter - Selected filter value.
   * @param {object} recipes - The existing recipes.
   * @return {object} Criteria recipe
   */
var createRecipeForGivenCategory = function( category, filter, recipes ) {
    var criteriaVal = [];
    var recipeOperator = 'Filter';
    var recipeExists;
    // TODO : in AW5.2 Partitions are shown as Psuedo Hierachy by appending "- " in front
    // To Populate Recipe We need Only its display name, so replacing "- " pattern from start of filter name to ''
    // This needs to be cleaned up once Partitions are shown using aw-tree widget.
    var displayFilterValue = filter.name.replace( new RegExp( '^(\- )*', 'g' ), '' );

    if( isTCVersion132OrLater() ) {
        var occContext = appCtxSvc.getCtx( _contextKey );
        var pciUID = occContext.productContextInfo.uid;
        var categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );
        if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap &&
              !categoryLogicEntry[ 0 ].categoryLogicMap[ category.displayName ] ) {
            recipeOperator = 'Exclude';
        }
        recipeExists = getRecipeForExistingCategory( recipes, filter );

        if( recipeExists ) {
            var recipe = _.cloneDeep( recipeExists );
            // Get the filter separator value from the preference AW_FacetValue_Separator
            var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
            recipe.criteriaValues.push( filter.internalName );
            recipe.criteriaDisplayValue += filterSeparator + displayFilterValue;

            return recipe;
        }
    }
    if( !recipeExists ) {
        criteriaVal.push( filter.categoryName );
        criteriaVal.push( filter.internalName );
        return {
            criteriaDisplayValue: category.displayName + '_$CAT_' + displayFilterValue,
            criteriaOperatorType: recipeOperator,
            criteriaType: category.categoryType,
            criteriaValues: criteriaVal,
            subCriteria: []
        };
    }
};

/**
   * Get the recipe for the category in the selected filter value
   * @param {object} recipes - List of recipes.
   * @param {object} filter - Selected filter value.
   * @return {object} Criteria recipe
   */
var getRecipeForExistingCategory = function( recipes, filter ) {
    var recipeForCategory;
    _.forEach( recipes, function( recipe ) {
        if( applicableCategoryTypes.includes( recipe.criteriaType ) && recipe.criteriaValues[ 0 ] === filter.categoryName ) {
            recipeForCategory = recipe;
        }
    } );
    return recipeForCategory;
};

var spatialRecipeExists = function( recipes, spatialType ) {
    var spatialExists = false;
    if( recipes.length === 1 && recipes[ 0 ].criteriaOperatorType === 'Clear' && recipes[ 0 ].criteriaType === spatialType ) {
        return false;
    }
    for( var index = 0; index < recipes.length; index++ ) {
        if( recipes[ index ].criteriaType === spatialType ) {
            spatialExists = true;
            break;
        }
    }
    return spatialExists;
};

var isSpatialRecipe = function( recipe ) {
    var isSpatial = false;
    if( recipe.criteriaType === 'Proximity' || recipe.criteriaType === 'BoxZone' || recipe.criteriaType === 'PlaneZone' ) {
        isSpatial = true;
    }
    return isSpatial;
};

/**
       * Update  recipe  with updated  values  for  same  category
       * @param {object} recipes - List of recipes.
       * @param {object} newRecipe - recipe to be updated if category exists.

       * @return {boolean} true if recipe  is  updated
       */
var replaceRecipeForExistingCategory = function( recipes, newRecipe ) {
    var replaceRecipe = false;
    if( applicableCategoryTypes.includes( newRecipe.criteriaType ) ) {
        for( var index = 0; index < recipes.length; index++ ) {
            if( recipes[ index ].criteriaValues[ 0 ] === newRecipe.criteriaValues[ 0 ] ) {
                recipes[ index ] = newRecipe;
                replaceRecipe = true;
                break;
            }
        }
    } else if( newRecipe.criteriaType === 'SelectedElement' ) {
        for( var j = 0; j < recipes.length; j++ ) {
            if( recipes[ j ].criteriaType === newRecipe.criteriaType &&
                  recipes[ j ].criteriaOperatorType === newRecipe.criteriaOperatorType ) {
                if ( occmgmtSubsetUtils.isTCVersion142OrLater() && newRecipe.criteriaOperatorType !== 'Exclude' ) {
                    // For selected term match last element in criteriavalues (true or false)
                    // to get the matching include term
                    var existingIncludeChildren = recipes[ j ].criteriaValues[recipes[ j ].criteriaValues.length - 1];
                    var newIncludeChildren = newRecipe.criteriaValues[newRecipe.criteriaValues.length - 1];
                    if ( existingIncludeChildren === newIncludeChildren ) {
                        updateSelectedElementRecipeTerm( recipes[ j ], newRecipe );
                        replaceRecipe = true;
                        break;
                    }
                } else {
                    updateSelectedElementRecipeTerm( recipes[ j ], newRecipe );
                    replaceRecipe = true;
                    break;
                }
            }
        }
    }
    return replaceRecipe;
};

/**
   * This function will update selected recipe term display values and criteria values
   * them as an array.
   *
   * @param {Object} matchedRecipe : Existing Selected Element recipe
   * @param {String} newRecipe : Selected Element to be added
   */
var updateSelectedElementRecipeTerm = function( matchedRecipe, newRecipe ) {
    // Get the filter separator value from the preference AW_FacetValue_Separator
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
    var selectedElementsDisplay = selectedTerms( newRecipe.criteriaDisplayValue, filterSeparator );
    // Add selected element if not already present in recipe
    // Concat the display value
    for( var i in selectedElementsDisplay ) {
        if( !matchedRecipe.criteriaDisplayValue.includes( selectedElementsDisplay[ i ] ) ) {
            matchedRecipe.criteriaDisplayValue += filterSeparator + selectedElementsDisplay[ i ];
        }
    }
    // Update the criteria values
    for( var j in newRecipe.criteriaValues ) {
        if( !matchedRecipe.criteriaValues.includes( newRecipe.criteriaValues[ j ] ) ) {
            if ( occmgmtSubsetUtils.isTCVersion142OrLater() && newRecipe.criteriaOperatorType !== 'Exclude' ) {
                matchedRecipe.criteriaValues.splice( matchedRecipe.criteriaValues.length - 1, 0, newRecipe.criteriaValues[ j ] );
            } else{
                matchedRecipe.criteriaValues.push( newRecipe.criteriaValues[ j ] );
            }
        }
    }
};

/**
   * Update  recipe  with updated  values  for  same  category
   * @param {object} recipes - List of recipes.
   * @param {object} newRecipe - recipe to be updated if category exists.
   */
var removeElementFromSelectedTerm = function( recipes, newRecipe ) {
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    for( var index = 0; index < recipes.length; index++ ) {
        if( recipes[ index ].criteriaType === newRecipe.criteriaType &&
              recipes[ index ].criteriaOperatorType === newRecipe.criteriaOperatorType ) {
            var matchedRecipe = recipes[ index ];
            var selectedElementsDisplay = selectedTerms( matchedRecipe.criteriaDisplayValue, filterSeparator );

            // Add selected element if not already present in recipe
            // Concat the display value
            for( var i in selectedElementsDisplay ) {
                if( !newRecipe.criteriaDisplayValue.includes( selectedElementsDisplay[ i ] ) ) {
                    // Update criteria display value
                    var caretBeforeDisplayValue = filterSeparator + selectedElementsDisplay[ i ];
                    var caretAfterDisplayValue = selectedElementsDisplay[ i ] + filterSeparator;
                    if( matchedRecipe.criteriaDisplayValue.includes( caretBeforeDisplayValue ) ) {
                        matchedRecipe.criteriaDisplayValue = matchedRecipe.criteriaDisplayValue.replace( caretBeforeDisplayValue, '' );
                    } else {
                        matchedRecipe.criteriaDisplayValue = matchedRecipe.criteriaDisplayValue.replace( caretAfterDisplayValue, '' );
                    }
                }
            }
            // Update the criteria values
            var indexToRemove = -1;
            for( var j in matchedRecipe.criteriaValues ) {
                if( !newRecipe.criteriaValues.includes( matchedRecipe.criteriaValues[ j ] ) ) {
                    indexToRemove = j;
                    break;
                }
            }
            matchedRecipe.criteriaValues.splice( indexToRemove, 1 );
            break;
        }
    }
};

/**
   * This function will extract all selected terms in the input recipe criteria and return
   * them as an array.
   *
   * @param {String} recipeDisplayName : Recipe Criteria Display Name
   * @param {String} filterSeparator : Filter Separator between the selected terms
   * @return {String[]} : An array of all selected terms in the input recipe criteria.
   */
var selectedTerms = function( recipeDisplayName, filterSeparator ) {
    var recipeValuesString = recipeDisplayName.split( '_$CAT_' )[ 1 ];
    var allSelectedTerms = {};
    if( recipeValuesString ) {
        allSelectedTerms = recipeValuesString.split( filterSeparator );
    }
    return allSelectedTerms;
};

/*
   * Get the supported TC version for multi valued attribute
   */
var isTCVersion132OrLater = function() {
    var isVersionSupported = false;
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    // If platform  is 13.2 or greater then return true
    if( tcMajor >= 13 && tcMinor >= 2 || tcMajor >= 14 ) {
        isVersionSupported = true;
    }
    return isVersionSupported;
};


/*
   * Remove attribute criteria value for same category
   */
var removeCriteriaValueFromCategory = function( recipe, filter ) {
    if( applicableCategoryTypes.includes( recipe.criteriaType ) && isTCVersion132OrLater() ) {
        // Get the filter separator value from the preference AW_FacetValue_Separator
        var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        recipe.criteriaValues.splice( recipe.criteriaValues.indexOf( filter.internalName ), 1 );

        // TODO : The Partitions are shown as "pseudo Hierarchy" by appending "- " in beginning of name
        // To Populate Recipe We need Only its display name, so replacing "- " pattern from start of filter name to ''
        // This needs to be cleaned up once it start showing using aw-tree widget.
        var displayFilterValue = filter.name.replace( new RegExp( '^(\- )*', 'g' ), '' );

        var caretInFrontDisplayValue = filterSeparator + displayFilterValue;
        var caretInBacktDisplayValue = displayFilterValue + filterSeparator;
        if( recipe.criteriaDisplayValue.includes( caretInFrontDisplayValue ) ) {
            recipe.criteriaDisplayValue = recipe.criteriaDisplayValue.replace( caretInFrontDisplayValue, '' );
        } else {
            recipe.criteriaDisplayValue = recipe.criteriaDisplayValue.replace( caretInBacktDisplayValue, '' );
        }
    }
};

/*
   * Find the given filter in the transient recipe list
   */
var findFilterInTransientRecipeList = function( recipes, filter ) {
    var recipeFound;
    for( var entry in recipes ) {
        if( applicableCategoryTypes.includes( recipes[ entry ].criteriaType ) && recipes[ entry ].criteriaValues[ 0 ] === filter.categoryName ) {
            for( var index = 1; index < recipes[ entry ].criteriaValues.length; index++ ) {
                if( recipes[ entry ].criteriaValues[ index ] === filter.internalName ) {
                    recipeFound = recipes[ entry ];
                    break;
                }
            }
        }
    }
    return recipeFound;
};

/*
   * Removes the orphan date filters from the recipe
   */
var removeOrphanDatesFromRecipes = function( recipes, orphanDateFilters ) {
    var orphanRecipes = [];
    for( var i = 0; i < orphanDateFilters.length; i++ ) {
        var foundOrphanRecipe = findFilterInTransientRecipeList( recipes, orphanDateFilters[ i ] );
        if( foundOrphanRecipe ) {
            orphanRecipes.push( foundOrphanRecipe );
            recipes.splice( recipes.indexOf( foundOrphanRecipe ), 1 );
        }
    }
    return orphanRecipes;
};

/*
   * Removes the filter if present from the filterValues and returns the orphan date entries in the filterValues.
   */
var getOrphanDateEntries = function( filterValues, filter ) {
    var dateFilters = [];
    if( filter === null || filter.internalName === undefined ) {
        dateFilters = filterValues;
    } else {
        for( var value in filterValues ) {
            if( filterValues[ value ].internalName !== filter.internalName ) {
                dateFilters.push( filterValues[ value ] );
            }
        }
    }
    return removeOrphanDateEntries( dateFilters );
};

/*
   * Add a spatial/selected element recipe
   */
var addRecipe = function( recipeState, sharedData ) {
    // Clone the current recipe if needed.
    cloneCurrentRecipesIfNeeded();
    var addedRecipe = sharedData.recipeTermToAdd;
    var clonedRecipe = _.cloneDeep( recipeState.recipe );
    // add the new recipe to transient recipes map
    addRecipeToCacheForCurrentPCI( clonedRecipe, addedRecipe, sharedData.spatialRecipeIndexToUpdate );
    // sync recipes in cache to update the view model
    return updateRecipesInCache( sharedData );
};

var getActiveFiltersForSearchStateAfterDelete = function( searchState, category, deletedRecipe, filterValuesDeselected ) {
    let filtersForCategory = searchState.activeFilters && searchState.activeFilters[ deletedRecipe.criteriaValues[ 0 ] ] ?
        searchState.activeFilters[ deletedRecipe.criteriaValues[ 0 ] ] : [];
    let updatedFilters = [];
    for( let index = 0; index < filtersForCategory.length; index++ ) {
        if( !filterValuesDeselected.includes( filtersForCategory[ index ] ) ) {
            updatedFilters.push( filtersForCategory[ index ] );
        }
    }

    let modifiedActiveFilters;
    if( searchState.activeFilters ) {
        modifiedActiveFilters = searchState.activeFilters;

        if( updatedFilters.length > 0 ) {
            modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ] = updatedFilters;
        } else {
            delete modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ];
        }
        if( category && category.type === 'DateFilter' && modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ] && modifiedActiveFilters[ deletedRecipe.criteriaValues[ 0 ] ].length > 0 ) {
            modifiedActiveFilters = searchFilterService.removeDependentDateFilters( modifiedActiveFilters );
        }
    }
    return modifiedActiveFilters;
};

/*
   * Update search state with new filter map based on given categories
   */
var updateSearchStateAfterFilterChange = function( searchState, searchStateUpdater, modifiedCategories, modifiedActiveFilters ) {
    const updateSearchStateAtomicData = searchStateUpdater.searchState;

    const selectedFiltersMap = getSelectedFiltersMap( modifiedCategories );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );

    const filterString = searchFilterService.buildFilterString( selectedFiltersMap );
    if( !modifiedActiveFilters ) {
        let activeFiltersInfo = searchCommonUtils.createActiveFiltersFromActiveFilterMap( selectedFiltersInfo.activeFilterMap );
        modifiedActiveFilters = activeFiltersInfo.activeFilters;
    }

    updateSearchStateAtomicData( {
        ...searchState,
        categories: modifiedCategories,
        filterString: filterString,
        activeFilters: modifiedActiveFilters,
        activeFilterMap: selectedFiltersInfo.activeFilters
    } );
};

/*
   * Update filter value selections for the category of deleted recipe
   */
var findAndUpdateCategoryWithFilterDeselection = function( modifiedCategories, deletedRecipe, deselectedFilters ) {
    var category;
    var dateFilterDeleted;
    var indexToUpdate;
    for( let index = 0; index < modifiedCategories.length; index++ ) {
        // Check for Date filter, Spatial filter and Attribute filters to find the category to update
        if( modifiedCategories[ index ].internalName === deletedRecipe.criteriaValues[ 0 ] ||
              modifiedCategories[ index ].type === 'DateFilter' && deletedRecipe.criteriaValues[ 0 ].startsWith( modifiedCategories[ index ].internalName ) ||
              modifiedCategories[ index ].internalName === 'SpatialSearch' && isSpatialRecipe( deletedRecipe ) ) {
            category = modifiedCategories[ index ];
            indexToUpdate = index;
            for( var k = 0; k < category.filterValues.length; k++ ) {
                if( deselectedFilters.includes( category.filterValues[ k ].internalName ) ) {
                    category.filterValues[ k ].selected.dbValue = false;
                    category.filterValues[ k ].selected.value = false;
                    if( category.type === 'DateFilter' ) {
                        dateFilterDeleted = _.cloneDeep( category.filterValues[ k ] );
                    }
                    deselectedFilters.splice( deselectedFilters.indexOf( category.filterValues[ k ].internalName ), 1 );
                    if( deselectedFilters.length === 0 ) {
                        break;
                    }
                }
            }
            break;
        }
    }
    return [ category, indexToUpdate, dateFilterDeleted ];
};

/*
   * Do search state and filter cache changes upon delete of recipe in bulk apply mode
   */
var modifySearchStateAndFilterCacheAfterRecipeDelete = function( searchState, searchStateUpdater, deletedRecipe, deselectedFilters, recipesToDisplay ) {
    let filterValuesDeselectedCopy = _.clone( deselectedFilters );
    let modifiedCategories = searchState.categories;
    // Find category in search state whose filter value selections have to be updated and toggle filter selection
    let [ category, indexToUpdate, dateFilterDeleted ] = findAndUpdateCategoryWithFilterDeselection( modifiedCategories, deletedRecipe, deselectedFilters );

    // Update the discovery filter cache with changed selections of filters
    // Re-evaluate category toggle visibility
    modifiedCategories = getCategoriesWithUpdatedCategoryLogicAfterFilterChange( modifiedCategories, recipesToDisplay );
    if( dateFilterDeleted ) {
        // Date filters are a special case as we have to remove orphan date filters
        modifiedCategories = syncDateFiltersInCacheOnFilterChange( modifiedCategories, searchState.colorToggle, category, dateFilterDeleted );
    } else {
        // All other filters except date are updated in cache
        modifiedCategories[ indexToUpdate ] = category;
        var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
        updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( modifiedCategories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );
    }
    // Update active filter array in search state and set updated filter map on search state
    // This will trigger the view update
    let modifiedActiveFilters = getActiveFiltersForSearchStateAfterDelete( searchState, category, deletedRecipe, filterValuesDeselectedCopy );
    updateSearchStateAfterFilterChange( searchState, searchStateUpdater, modifiedCategories, modifiedActiveFilters );
};

/*
   * Do search state, filter cache and recipe state changes upon delete of recipe in bulk apply mode
   */
var updateFiltersAfterRecipeDeleteInBulkApplyMode = function( searchStateUpdater, searchState, recipeState, deletedRecipe, updatedRecipes, recipesToDisplay ) {
    const updateRecipeStateAtomicData = searchStateUpdater.recipeState;

    // Modify filter cache and search state with updated selections
    if( deletedRecipe && ( applicableCategoryTypes.includes( deletedRecipe.criteriaType ) || isSpatialRecipe( deletedRecipe ) ) ) {
        // Get removed filters from deleted recipe
        var filterValuesDeselected = updateDeselectedFiltersOnDelete( deletedRecipe, updatedRecipes );
        // Filter cache and search state update
        modifySearchStateAndFilterCacheAfterRecipeDelete( searchState, searchStateUpdater, deletedRecipe, filterValuesDeselected, recipesToDisplay );
    }
    // Recipe state update with new recipe
    updateRecipeStateAtomicData( { ...recipeState, recipe: recipesToDisplay } );
};

/**
   * Process the recipe update - delete of recipe, operator change on recipe, proximity value change
   * @param {Object} updatedRecipes - updated recipe list.
   * @param {Object} deletedRecipe - deleted recipe term.
   * @param {Object} updateAtomicData - atomic data updater.
   * @param {Object} searchState - filter panel atomic data.
   * @param {Object} recipeState - recipe component atomic data.
   * @param {Object} sharedData - shared data with sub panels.
   * @param {Object} occContext - ace atomic data.
   */
export let processRecipeOnUpdate = function( updatedRecipes, deletedRecipe, updateAtomicData, searchState, recipeState, sharedData, occContext ) {
    // Clone the current recipe if needed.
    cloneCurrentRecipesIfNeeded();

    // Update the transient recipes map


    // Remove orphan date recipes on delete
    var orphanDateRecipes = [];
    if( deletedRecipe ) {
        orphanDateRecipes = getOrphanDateRecipesOnDelete( deletedRecipe, updatedRecipes );
        for( var i = 0; i < orphanDateRecipes.length; i++ ) {
            updatedRecipes.splice( updatedRecipes.indexOf( orphanDateRecipes[ i ] ), 1 );
        }
        // The last recipe is being deleted after orphan date recipes are removed
        if( updatedRecipes.length === 0 ) {
            updatedRecipes.push( deletedRecipe );
            updatedRecipes[ 0 ].criteriaOperatorType = 'Clear';
        }
    }

    replaceRecipesToCacheForCurrentPCI( updatedRecipes );

    if( sharedData.autoApply ) {
        let updateSearchStateAtomicData = updateAtomicData.searchState;
        let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
        updateSearchStateAtomicData( newSearchState );
        // Trigger SOA call to apply filter/recipe
        applyFilter( updatedRecipes, occContext );
        return;
    }

    // Sync recipes in cache to update the view model
    var [ recipesToDisplay, enableApply ] = updateRecipesInCache( sharedData );
    const newSharedData = { ...sharedData.getValue() };
    newSharedData.enableFilterApply = enableApply;
    sharedData.update && sharedData.update( newSharedData );

    // Update filters in cache and change the search state to reflect the filter updates
    updateFiltersAfterRecipeDeleteInBulkApplyMode( updateAtomicData, searchState, recipeState, deletedRecipe, updatedRecipes, recipesToDisplay );
};

/*
   * Add a given criteria(attribute/spatial) to transient recipe cache.
   */
var addRecipeToCacheForCurrentPCI = function( currentRecipe, newRecipeToAdd, spatialRecipeIndexToUpdate ) {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var pciUID = occMgmtCtx.productContextInfo.uid;
    var pciVsRecipeInfoEntry = {};

    var newTransientRecipe;
    var updatedRecipeToDisplay;
    if( !currentRecipe ) {
        newTransientRecipe = [];
    } else {
        newTransientRecipe = _.cloneDeep( currentRecipe );
    }

    var isRecipeReplaced = false;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        var recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === pciUID;
        } );

        if( recipesData && recipesData[ 0 ] ) {
            if( recipesData[ 0 ].transientRecipes.length === 1 && recipesData[ 0 ].transientRecipes[ 0 ].criteriaOperatorType === 'Clear' ) {
                recipesData[ 0 ].transientRecipes = [];
            }

            if( newRecipeToAdd.criteriaType === 'Proximity' ) {
                if( spatialRecipeIndexToUpdate >= 0 && spatialRecipeIndexToUpdate < recipesData[ 0 ].transientRecipes.length ) {
                    recipesData[ 0 ].transientRecipes[ spatialRecipeIndexToUpdate ] = newRecipeToAdd;
                } else {
                    recipesData[ 0 ].transientRecipes.push( newRecipeToAdd );
                }
            } else {
                // If TC Version is 132 or greater and the new recipe category exists in transient list
                // It replaces the new updated recipe in the transient list and returns true
                if( isTCVersion132OrLater() ) {
                    isRecipeReplaced = replaceRecipeForExistingCategory( recipesData[ 0 ].transientRecipes, newRecipeToAdd );
                }
                // Add the new recipe to transient list
                // If the TC Version is less that 132
                // Or if the new recipe  category is not present in transient list
                if( !isRecipeReplaced ) {
                    // Include of Selected Element should be the last term in the recipe list
                    var recipesLength = recipesData[ 0 ].transientRecipes.length;
                    var isTcVersion142AndLater = occmgmtSubsetUtils.isTCVersion142OrLater();
                    if ( isTcVersion142AndLater ) {
                        if ( recipesLength === 0 ) {
                            recipesData[ 0 ].transientRecipes.push( newRecipeToAdd );
                        } else { // include terms added in order they are added to recipe
                            for( let i = recipesLength - 1; i >= 0; i-- ) {
                                if ( recipesData[ 0 ].transientRecipes[ i ].criteriaType === 'SelectedElement' &&
                                       recipesData[ 0 ].transientRecipes[ i ].criteriaOperatorType === 'Include' ) {
                                    if( recipesLength > 1 &&
                                          recipesData[ 0 ].transientRecipes[ i - 1 ].criteriaType === 'SelectedElement' &&
                                          recipesData[ 0 ].transientRecipes[ i - 1 ].criteriaOperatorType === 'Include' ) {
                                        recipesData[ 0 ].transientRecipes.splice( i - 1, 0, newRecipeToAdd );
                                        break;
                                    } else {
                                        // add logic to always place at the end if new recipe is Include SelectedElement otherwise splice
                                        if( newRecipeToAdd.criteriaType === 'SelectedElement' &&
                                              newRecipeToAdd.criteriaOperatorType === 'Include' ) {
                                            recipesData[ 0 ].transientRecipes.push( newRecipeToAdd );
                                            break;
                                        } else {
                                            recipesData[ 0 ].transientRecipes.splice( i, 0, newRecipeToAdd );
                                            break;
                                        }
                                    }
                                } else {
                                    recipesData[ 0 ].transientRecipes.push( newRecipeToAdd );
                                    break;
                                }
                            }
                        }
                    } else {
                        if( recipesLength > 0 &&
                              recipesData[ 0 ].transientRecipes[ recipesLength - 1 ].criteriaType === 'SelectedElement' &&
                              recipesData[ 0 ].transientRecipes[ recipesLength - 1 ].criteriaOperatorType === 'Include' ) {
                            recipesData[ 0 ].transientRecipes.splice( recipesLength - 1, 0, newRecipeToAdd );
                        } else {
                            recipesData[ 0 ].transientRecipes.push( newRecipeToAdd );
                        }
                    }
                }
            }
            updatedRecipeToDisplay = _.cloneDeep( recipesData[ 0 ].transientRecipes );
        } else {
            newTransientRecipe.push( newRecipeToAdd );
            pciVsRecipeInfoEntry = {
                pciUid: pciUID,
                transientRecipes: newTransientRecipe
            };
            pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
            updatedRecipeToDisplay = _.cloneDeep( newTransientRecipe );
        }
    } else {
        newTransientRecipe.push( newRecipeToAdd );
        pciVsRecipeInfoEntry = { // eslint-disable-line no-redeclare
            pciUid: pciUID,
            transientRecipes: newTransientRecipe
        };
        pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
        updatedRecipeToDisplay = _.cloneDeep( newTransientRecipe );
    }

    return updatedRecipeToDisplay;
};

/**
   * Replace the given recipes in the transient recipe map for the current pciuid
   * @param {Object} updatedRecipes updated list of recipes
   */
var replaceRecipesToCacheForCurrentPCI = function( updatedRecipes ) {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var productContextInfoUID = occMgmtCtx.productContextInfo.uid;

    var recipesData;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
    }
    if( recipesData && recipesData[ 0 ] ) {
        recipesData[ 0 ].transientRecipes = _.cloneDeep( updatedRecipes );
    }
};

/*
   * Create an initial list of transient recipes from the existing persistent recipes.
   * The cloned list is created on the first edit before the apply.
   */
var cloneCurrentRecipesIfNeeded = function() {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
    var clonedRecipes = _.cloneDeep( occMgmtCtx.recipe );

    if( clonedRecipes.length > 0 ) {
        var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );
        if( transientRecipes === undefined ) {
            // There is no entry in pciToRecipeMap for the current pciuid yet.
            // Create an entry and add the cloned recipes
            var newRecipes = [];
            _.forEach( clonedRecipes, function( currentRecipe ) {
                newRecipes.push( currentRecipe );
            } );
            var pciVsRecipeInfoEntry = { // eslint-disable-line no-redeclare
                pciUid: productContextInfoUID,
                transientRecipes: newRecipes
            };
            pciToTransientRecipesMap.push( pciVsRecipeInfoEntry );
        } else if( transientRecipes.length === 0 ) {
            _.forEach( clonedRecipes, function( currentRecipe ) {
                transientRecipes.push( currentRecipe );
            } );
            replaceRecipesToCacheForCurrentPCI( transientRecipes );
        }
    }
};

/*
   * Lookup and return the transient recipes for the given product context info uid
   */
var lookupRecipesInfoInCache = function( productContextInfoUID ) {
    var recipesData;
    if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
        recipesData = pciToTransientRecipesMap.filter( function( x ) {
            return x.pciUid === productContextInfoUID;
        } );
        if( recipesData && recipesData[ 0 ] ) {
            return recipesData[ 0 ].transientRecipes;
        }
    }
};

/*
  * Update recipes in transient recipe cache
  */
var updateRecipesInCache = function( sharedData ) {
    let enableApply = false;
    var occContext = appCtxSvc.getCtx( _contextKey );

    // Retrieve all the transient recipe list
    var productContextInfoUID = occContext.productContextInfo.uid;
    var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );

    // Add all the selected transient recipes to the new recipe list.
    // Remove all the deselected transient recipes from the
    // new recipe(which includes current recipe) list.
    var recipesToDisplay = transientRecipes;
    if( transientRecipes ) {
        updateCtxRecipeInfoFromCache( productContextInfoUID );
        occContext = appCtxSvc.getCtx( _contextKey );
        // This is persisted recipe list
        var currentRecipes = _.cloneDeep( occContext.recipe );

        if( !sharedData.autoApply ) {
            var transientRecipesToDisplay = [];
            _.forEach( transientRecipes, function( transientRecipe ) {
                if( transientRecipe.criteriaOperatorType !== 'Clear' ) {
                    transientRecipesToDisplay.push( transientRecipe );
                }
            } );
            enableApply = areRecipesChanged( currentRecipes, transientRecipesToDisplay );
            recipesToDisplay = transientRecipesToDisplay;
        }
        if( recipesToDisplay && recipesToDisplay.length === 1 && recipesToDisplay[ 0 ].criteriaOperatorType === 'Clear' ) {
            // Case where the transient recipe was cleared
            //and then the bulk apply mode was reset to auto apply
            recipesToDisplay = [];
        }
        updateRecipeOnContext( _.cloneDeep( transientRecipes ) );
    } else {
        updateCtxRecipeInfoFromCache( productContextInfoUID );
        // Get the latest copy of occContext object as updateCtxRecipeInfoFromCache method updates the recipe on occContext object
        // and previous occContext object fetched would have stale recipe info
        occContext = appCtxSvc.getCtx( _contextKey );
        recipesToDisplay = _.cloneDeep( occContext.recipe );
    }
    revalidateIncludeExcludeCommandVisibility( recipesToDisplay );
    return [ recipesToDisplay, enableApply ];
};

/*
   * Check if the list of current recipes are different from the list of transient recipes.
   */
var areRecipesChanged = function( currentRecipes, newRecipes ) {
    if( currentRecipes.length !== newRecipes.length ) {
        // recipe is added or deleted
        return true;
    }
    if( currentRecipes.length === 0 && newRecipes.length === 0 ) {
        // No change
        return false;
    }
    for( var i = 0; i < newRecipes.length; i++ ) {
        if( newRecipes[ i ].criteriaType !== currentRecipes[ i ].criteriaType ||
              newRecipes[ i ].criteriaOperatorType !== currentRecipes[ i ].criteriaOperatorType ||
              newRecipes[ i ].criteriaValues.length !== currentRecipes[ i ].criteriaValues.length ) {
            return true;
        }
        for( var j = 0; j < newRecipes[ i ].criteriaValues.length; j++ ) {
            if( newRecipes[ i ].criteriaValues[ j ] !== currentRecipes[ i ].criteriaValues[ j ] ) {
                return true;
            }
        }
    }
    return false;
};

var syncDateFiltersInCacheOnFilterChange = function( processedCategories, colorToggle, category, filter ) {
    // Sync for orphan dates
    var filterValues = _.cloneDeep( category.filterValues );
    var dateRemovedEntries = getOrphanDateEntries( filterValues, filter );

    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    var rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    var soaFilterValues = rawFilterMapValues[ filter.categoryName ];

    for( var i = 0; i < soaFilterValues.length; i++ ) {
        if( soaFilterValues[ i ].stringValue === filter.internalName ) {
            soaFilterValues[ i ].selected = filter.selected.value;
            if( !dateRemovedEntries || dateRemovedEntries.length === 0 ) {
                break;
            }
        } else if( dateRemovedEntries.includes( soaFilterValues[ i ].stringValue ) ) {
            soaFilterValues[ i ].selected = false;
        }
    }
    rawFilterMapValues[ filter.categoryName ] = soaFilterValues;

    category.filterValues = filterPanelService.getFiltersForCategory( category,
        rawFilterMapValues, undefined, colorToggle );

    var modifiedCategories = _.cloneDeep( processedCategories );
    for( let j = 0; j < modifiedCategories.length; j++ ) {
        if( category.internalName === modifiedCategories[ j ].internalName ) {
            modifiedCategories[ j ] = category;
            break;
        }
    }
    updateCategoriesInfoCacheForCurrentPCI( modifiedCategories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );
    return modifiedCategories;
};

/*
   * Update the local pci to filter values cache and update the view model given selected/deselected filter
   */
var syncFiltersInCacheOnFilterChange = function( processedCategories, category, filter ) {
    if( applicableCategoryTypes.includes( category.categoryType ) ) {
        return syncFilterInfo( processedCategories, filter.categoryName, filter.internalName, filter.selected.value, true );
    }
};

var isMultiValueTermDeletedOrUpdated = function( deletedRecipe, updatedRecipe ) {
    var criteriaValuesInDelete = deletedRecipe.criteriaValues;
    var clearAllValues = false;
    var recipeFound = false;
    for( var recipe in updatedRecipe ) {
        if( updatedRecipe[ recipe ].criteriaValues[ 0 ] === criteriaValuesInDelete[ 0 ] ) {
            recipeFound = true;
            if( updatedRecipe[ recipe ].criteriaOperatorType === 'Clear' ) {
                clearAllValues = true;
                break;
            }
        }
    }
    return [ clearAllValues, recipeFound ];
};

/*
   * Update the local pci to filter values cache and update the view model given deleted recipe
   */
var updateDeselectedFiltersOnDelete = function( deletedRecipe, updatedRecipe ) {
    var multiValueTermDeletedOrUpdated = [ false, false ];
    var filterValuesDeselected = [];

    if( applicableCategoryTypes.includes( deletedRecipe.criteriaType ) ) {
        multiValueTermDeletedOrUpdated = isMultiValueTermDeletedOrUpdated( deletedRecipe, updatedRecipe );
        var criteriaValuesInDelete = deletedRecipe.criteriaValues;

        if( multiValueTermDeletedOrUpdated[ 0 ] || !multiValueTermDeletedOrUpdated[ 1 ] ) {
            // Entire recipe term is deleted
            for( var j = 1; j < criteriaValuesInDelete.length; j++ ) {
                syncFilterInfo( null, criteriaValuesInDelete[ 0 ], criteriaValuesInDelete[ j ], false, false );
                filterValuesDeselected.push( criteriaValuesInDelete[ j ] );
            }
        } else {
            // Value in recipe term is deleted, sync filter value
            for( var recipe in updatedRecipe ) {
                if( updatedRecipe[ recipe ].criteriaValues[ 0 ] === criteriaValuesInDelete[ 0 ] ) {
                    for( var k = 1; k < criteriaValuesInDelete.length; k++ ) {
                        if( !updatedRecipe[ recipe ].criteriaValues.includes( criteriaValuesInDelete[ k ] ) ) {
                            syncFilterInfo( null, criteriaValuesInDelete[ 0 ], criteriaValuesInDelete[ k ], false, false );
                            filterValuesDeselected.push( criteriaValuesInDelete[ k ] );
                            break;
                        }
                    }
                }
            }
        }
    } else if( isSpatialRecipe( deletedRecipe ) && !spatialRecipeExists( updatedRecipe, deletedRecipe.criteriaType ) ) {
        syncFilterInfo( null, 'SpatialSearch', deletedRecipe.criteriaType, false, false );
        filterValuesDeselected.push( deletedRecipe.criteriaType );
    }
    return filterValuesDeselected;
};

/*
   * Sync facet selections in updateFilterValues from performFacetSearch from transient recipe cache the in delay mode
   */
var syncFiltersInCacheOnFacetSearch = function( updatedFilterValues, updatedCatName, filterBy ) {
    // Retrieve all the transient recipe list
    var productContextInfoUID = appCtxSvc.getCtx( _contextKey ).productContextInfo.uid;
    var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );

    if( transientRecipes === undefined || transientRecipes.length === 0 ) {
        return;
    }

    // Sync facet selections for updateFilterValues for transientRecipe is one and deleted
    if( transientRecipes.length === 1 && transientRecipes[ 0 ].criteriaOperatorType === 'Clear' &&
          transientRecipes[ 0 ].criteriaValues[ 0 ] === updatedCatName ) {
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( transientRecipes[ 0 ].criteriaValues.includes( filterValue.stringValue ) &&
                  filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
        return;
    }

    // Find transient recipe matching the category name
    var recipeFound;
    for( var recipe in transientRecipes ) {
        if( transientRecipes[ recipe ].criteriaValues[ 0 ] === updatedCatName ) {
            recipeFound = transientRecipes[ recipe ];
            break;
        }
    }

    if( recipeFound ) {
        // Sync facet selections for updateFilterValues for transient recipe term
        // If any filterValues that are found in the recipe is not selected, then set the selected as true.
        // If any filterValues that are NOT found in the recipe is selected then set the selected as false.
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( recipeFound.criteriaValues.includes( filterValue.stringValue ) ) {
                if( !filterValue.selected ) {
                    filterValue.selected = true;
                }
            } else if( filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
        // If any recipe is not found in the filterValues then create a filter value entry to be in sync with recipe.
        // This is for the case when selected transient recipe value is not returned in the filterValues since it is not
        // in the current page returned. try this
        if( applicableCategoryTypes.includes( recipeFound.criteriaType ) ) {
            var updatedFilterStringValues = [];
            _.forEach( updatedFilterValues, function( filterValue ) {
                updatedFilterStringValues.push( filterValue.stringValue );
            } );

            for( var index = 1; index < recipeFound.criteriaValues.length; index++ ) {
                if( !updatedFilterStringValues.includes( recipeFound.criteriaValues[ index ] ) &&
                      ( filterBy.length > 0 && recipeFound.criteriaValues[ index ].indexOf( filterBy ) !== -1 || filterBy.length === 0 ) ) {
                    //Create a filter value entry
                    var missingFilter = {};
                    missingFilter.selected = true;
                    missingFilter.stringValue = recipeFound.criteriaValues[ index ];
                    missingFilter.stringDisplayValue = recipeFound.criteriaValues[ index ];
                    missingFilter.searchFilterType = 'StringFilter';
                    updatedFilterValues.push( missingFilter );
                }
            }
        }
    } else {
        // Set facet selections for updateFilterValues to false if persisted recipe term is deleted in transient mode
        _.forEach( updatedFilterValues, function( filterValue ) {
            if( filterValue.selected ) {
                filterValue.selected = false;
            }
        } );
    }
};

var clearFilterInfo = function( searchState, searchStateUpdater ) {
    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    var rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    for( var rawFilterMapKey in rawFilterMapValues ) {
        var filterValues = rawFilterMapValues[ rawFilterMapKey ];
        for( var i = 0; i < filterValues.length; i++ ) {
            filterValues[ i ].selected = false;
        }
        rawFilterMapValues[ rawFilterMapKey ] = filterValues;
    }

    const newSearchState = updateFilterInfo( searchState, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe, false );
    // Clear category logic before updating search state
    let categories = newSearchState.categories;
    for( var j in categories ) {
        categories[ j ].isExcludeCategorySupported = false;
    }
    newSearchState.categories = categories;
    var updateSearchStateAtomicData = searchStateUpdater.searchState;
    updateSearchStateAtomicData( newSearchState );
};

/*
   * Update the local pci to filter values cache and update the view model
   */
var syncFilterInfo = function( processedCategories, categoryName, filterValue, selected, update ) {
    var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
    var rawFilterMapValues = rawCategoriesInfo.rawCategoryValues;
    var filterValues = rawFilterMapValues[ categoryName ];
    for( var i = 0; i < filterValues.length; i++ ) {
        if( filterValues[ i ].stringValue === filterValue ) {
            filterValues[ i ].selected = selected;
            break;
        }
    }
    rawFilterMapValues[ categoryName ] = filterValues;
    if( update ) {
        let clonedProcessedCategories = _.cloneDeep( processedCategories );
        updateCategoriesInfoCacheForCurrentPCI( clonedProcessedCategories, rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );
    }
    return processedCategories;
};

/*
   * Update filter value selections for the category of deleted recipe
   */
var findAndUpdateCategoryWithFilterSelection = function( modifiedCategories, categoryName, selectedFilter ) {
    var category;
    var indexToUpdate;
    for( let index = 0; index < modifiedCategories.length; index++ ) {
        // Check for Date filter, Spatial filter and Attribute filters to find the category to update
        if( modifiedCategories[ index ].internalName === categoryName ||
              modifiedCategories[ index ].type === 'DateFilter' && categoryName.startsWith( modifiedCategories[ index ].internalName ) ) {
            category = modifiedCategories[ index ];
            indexToUpdate = index;
            for( var k = 0; k < category.filterValues.length; k++ ) {
                if( selectedFilter.internalName === category.filterValues[ k ].internalName ) {
                    category.filterValues[ k ].selected.dbValue = true;
                    category.filterValues[ k ].selected.value = true;
                    break;
                }
            }
            break;
        }
    }
    return [ category, indexToUpdate ];
};

/**
   * Check if the filter selection/deselection is valid to continue.
   *
   * @param {Object} searchStateUpdater atomic data updater
   * @param {Object} searchState filter panel atomic data object
   * @param {Object} recipeState recipe component atomic data
   * @param {Object} filter selected filter value
   * @returns {boolean} : Returns true if filter change allowed; false otherwise
   */
var validForFilterChange = function( searchStateUpdater, searchState, recipeState, filter ) {
    var canDeselect = true;
    // Deselection of a filter value is not allowed when
    // a. its category is the first recipe in the list of recipes
    // b. there are more than one recipe
    // c. recipe corresponding to the deselected filter is a single valued recipe
    const recipe = recipeState.recipe;
    if( !filter.selected.value && recipe && recipe.length > 1 ) {
        if( filter.categoryName === recipe[ 0 ].criteriaValues[ 0 ] &&
              recipe[ 0 ].criteriaValues.length === 2 ) {
            canDeselect = false;
        }
        if( !canDeselect ) {
            var resource = 'OccurrenceManagementSubsetConstants';
            var localTextBundle = localeSvc.getLoadedText( resource );
            var validationMsg = 'deselectValidationMsg';
            var okButtonText = 'okButtonText';
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: localTextBundle[ okButtonText ],
                onClick: function( $noty ) {
                    $noty.close();
                }
            } ];
            notyService.showWarning( localTextBundle[ validationMsg ], buttons );

            // Reset filter deselection that is not allowed
            const newSearchState = { ...searchState };
            let modifiedCategories = newSearchState.categories;
            let [ category, indexToUpdate ] = findAndUpdateCategoryWithFilterSelection( modifiedCategories, filter.categoryName, filter );
            modifiedCategories[ indexToUpdate ] = category;
            var rawCategoriesInfo = getRawCategoriesAndCategoryValues( appCtxSvc.ctx[ _contextKey ].productContextInfo.uid );
            updateCategoriesInfoCacheForCurrentPCI( _.cloneDeep( modifiedCategories ), rawCategoriesInfo.rawCategories, rawCategoriesInfo.rawCategoryValues, rawCategoriesInfo.recipe );
            updateSearchStateAfterFilterChange( searchState, searchStateUpdater, modifiedCategories, null );

            return canDeselect;
        }
    }
    return canDeselect;
};

/**
   * Check  if product is discovery indexed.
   *
   * @returns {boolean} : Returns true if discovery indexed
   */
export let isDiscoveryIndexed = function() {
    var isDiscovery = false;
    let context = appCtxSvc.getCtx( _contextKey );
    if( context && context.currentState && context.currentState.pci_uid && cdm.isValidObjectUid( context.currentState.pci_uid ) ) {
        var supportedFeatures =  occmgmtStateHandler.getSupportedFeaturesFromPCI( cdm.getObject( context.currentState.pci_uid ) );
        if( supportedFeatures && supportedFeatures.Awb0EnableSmartDiscoveryFeature ) {
            isDiscovery = true;
        }
    }
    return isDiscovery;
};

var setCalculateFilters = function( calculateFiltersValue ) {
    var value = {
        requestPref: {
            calculateFilters: calculateFiltersValue
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
};

var registerListeners = function() {
    if( !_onDiscoveryFilterPanelCloseListener ) {
        _onDiscoveryFilterPanelCloseListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
            if( eventData && eventData.name === 'activeNavigationCommand' && _onDiscoveryFilterPanelCloseListener ) {
                // Unregister all listeners when panel is closed.
                unregisterListeners();
            }
        }, 'discoveryFilterService' );
    }
};

var unregisterListeners = function() {
    var context = appCtxSvc.getCtx( _contextKey );
    if( context ) {
        setCalculateFilters( false );
    }

    if( _productContextChangeEventListener ) {
        eventBus.unsubscribe( _productContextChangeEventListener );
        _productContextChangeEventListener = null;
    }
    if( _onDiscoveryFilterPanelCloseListener ) {
        eventBus.unsubscribe( _onDiscoveryFilterPanelCloseListener );
        _onDiscoveryFilterPanelCloseListener = null;
    }

    if( discoveryFilterEventSubscriptions ) {
        _.forEach( discoveryFilterEventSubscriptions, function( subDef ) {
            eventBus.unsubscribe( subDef );
        } );
        discoveryFilterEventSubscriptions = [];
    }
};

export let processInitialDelayedApplyPreference = function( result, data, activeViewSharedData, sharedData ) {
    var autoApply; var prefValue;
    if( result && result.response.length > 0 ) {
        for( var i = 0; i < result.response.length; i++ ) {
            if( result.response[ i ].definition.name === 'AWC_Discovery_Delayed_Filter_Apply' ) {
                prefValue = result.response[ i ].values.values[ 0 ];
                if( prefValue.toUpperCase() === 'TRUE' ) {
                    autoApply = false;
                } else {
                    autoApply = true;
                }
            } else if( result.response[ i ].definition.name === 'AWS_Enable_Partition_Hierarchy_On_Filter_Panel' ) {
                prefValue = result.response[ i ].values.values[ 0 ];
                if( prefValue.toUpperCase() === 'TRUE' ) {
                    isPartitionHierarchySupported = true;
                }
            }
        }
    }
    occmgmtSubsetUtils.updateAutoApplyOnSharedData( activeViewSharedData, sharedData, '', autoApply );
};

/**
   * Evaluate if the selected elements are valid for adding to include/exclude recipe terms
   * @param {Object} validSelectedObjects list of valid selected objects
   *
   */
export let validateTermsToIncludeOrExclude = function( validSelectedObjects ) {
    if( isTCVersion132OrLater() ) {
        if( validSelectedObjects && validSelectedObjects.length >= 1 && validSelectedObjects.length === appCtxSvc.ctx.mselected.length ) {
            var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
            var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
            var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );
            if( transientRecipes && transientRecipes.length > 0 && transientRecipes[ 0 ].criteriaOperatorType !== 'Clear' ) {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', true, 'filter' );
            }  else if( transientRecipes && transientRecipes.length > 0 && transientRecipes[ 0 ].criteriaOperatorType === 'Clear' ) {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', false, 'filter' );
            } else if( occMgmtCtx.productContextInfo && occMgmtCtx.productContextInfo.props.awb0FilterCount &&
                  occMgmtCtx.productContextInfo.props.awb0FilterCount.dbValues[ 0 ] > 0 ) {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', true, 'filter' );
            } else {
                occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', false, 'filter' );
            }
        } else {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsToIncludeOrExclude', false, 'filter' );
        }
    }
};

/**
   * Clear all the cache in this service. This function is called on Reset
   *
   */
export let clearAllCacheOnReset = function() {
    clearCache();
    clearRecipeFromContext();
    clearRecipeCache( undefined, true );
    pciToCategoryLogicMap = [];
};

/**
   * Initialize
   * @param {Object} sharedData shared data with sub panel
   */
export let initialize = function( sharedData ) {
    setCalculateFilters( true );

    if( discoveryFilterEventSubscriptions.length === 0 ) {
        discoveryFilterEventSubscriptions.push( eventBus.subscribe( 'ace.resetStructureStarted', function() {
            if(  isDiscoveryIndexed() || createWorksetService.isWorkset( appCtxSvc.ctx.mselected[ 0 ] )  ) {
                const newSharedData = { ...sharedData.getValue() };
                newSharedData.enableFilterApply = false;
                sharedData.update && sharedData.update( newSharedData );
            }
        } ) );

        // Subscribe to occDataLoadedEvent to update PWA
        discoveryFilterEventSubscriptions.push( eventBus.subscribe( 'occDataLoadedEvent', function() {
            if( isDiscoveryIndexed() ) {
                setCalculateFilters( true );
            }
        } ) );

        eventBus.subscribe( 'ace.updateFilterPanel', function() {
            if( isDiscoveryIndexed() ) {
                var context = appCtxSvc.getCtx( _contextKey );
                if( context ) {
                    setCalculateFilters( true );
                }
            }
        } );
        // Set recipe operator as filter when subset panel is opened initially.
        if( appCtxSvc.ctx[ _contextKey ] !== undefined &&
              !appCtxSvc.ctx[ _contextKey ].recipeOperator ) {
            occmgmtUtils.updateValueOnCtxOrState( 'recipeOperator', 'Filter', _contextKey );
        }
    }
    proximityFilterService.initialize();
    registerListeners();
};

export let clearRecipe = function( searchState, recipeState, searchStateUpdater, occContext, sharedData ) {
    if( recipeState.isClearAll ) {
        var updatedRecipeOnClear = [];
        // Create dummy recipe first term with operator clear
        if( appCtxSvc.ctx[ _contextKey ].recipe && appCtxSvc.ctx[ _contextKey ].recipe.length > 0 ) {
            // If persisted recipe has non zero recipe term
            // Create recipe with one term and 'Clear' operator so that when user applies
            // the recipe, server understands it as clearing the recipe
            var recipeToClear = _.cloneDeep( appCtxSvc.ctx[ _contextKey ].recipe[ 0 ] );
            recipeToClear.criteriaOperatorType = 'Clear';
            updatedRecipeOnClear.push( recipeToClear );
        }

        var pciUID = appCtxSvc.ctx[ _contextKey ].productContextInfo.uid;
        var pciToRecipeInfo;
        // Clear transient map
        if( pciToTransientRecipesMap && pciToTransientRecipesMap.length > 0 ) {
            var recipesData = pciToTransientRecipesMap.filter( function( x ) {
                return x.pciUid === pciUID;
            } );
            if( recipesData && recipesData[ 0 ] ) {
                recipesData[ 0 ].transientRecipes = updatedRecipeOnClear;
            } else {
                pciToRecipeInfo = {
                    pciUid: pciUID,
                    transientRecipes: updatedRecipeOnClear
                };
                pciToTransientRecipesMap.push( pciToRecipeInfo );
            }
        } else {
            pciToRecipeInfo = {
                pciUid: pciUID,
                transientRecipes: updatedRecipeOnClear
            };
            pciToTransientRecipesMap.push( pciToRecipeInfo );
        }

        if( pciToCategoryLogicMap ) {
            var categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
                return x.pciUid === pciUID;
            } );

            if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
                // Update existing entry for category logic cache
                let categoryLogicMap = categoryLogicEntry[ 0 ].categoryLogicMap;
                var keys = Object.keys( categoryLogicMap );
                _.forEach( keys, function( key ) {
                    categoryLogicMap[ key ] = true; // default logic is true implying 'Filter'
                } );
                categoryLogicEntry[ 0 ].categoryLogicMap = categoryLogicMap;
            }
        }

        updateRecipeOnContext( updatedRecipeOnClear );
        var effectiveRecipe = appCtxSvc.ctx[ _contextKey ].effectiveRecipe;
        // Apply filter if in auto-update mode
        if( searchState.autoApplyFilters ) {
            applyFilter( effectiveRecipe, occContext );
        } else {
            // Update recipe state
            let newRecipeState = { ...recipeState };
            newRecipeState.recipe = [];
            newRecipeState.isClearAll = false;
            var updateRecipeStateAtomicData = searchStateUpdater.recipeState;
            updateRecipeStateAtomicData( { ...recipeState, recipe: [], isClearAll: false } );

            // Update search state
            clearFilterInfo( searchState, searchStateUpdater );

            revalidateIncludeExcludeCommandVisibility( [] );

            // Enable Filter button
            var currentRecipes = _.cloneDeep( appCtxSvc.ctx[ _contextKey ].recipe );
            var shouldEnableApply = areRecipesChanged( currentRecipes, updatedRecipeOnClear );
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = shouldEnableApply;
            sharedData.update && sharedData.update( newSharedData );
        }
    }
};

/**
   * This method is to do post processing of recipes after getSubsetInfo3 SOA call is done.
   * This includes populating Subset panel's Viewmodel data
   * @param {Object} recipes list of recipes
   * @param {Object} subPanelContext panel context
   */
var processRecipeFromSubsetResponse = function( recipes, subPanelContext ) {
    if( recipes ) {
        occmgmtUtils.updateValueOnCtxOrState( 'recipe', recipes, _contextKey );
    }
    clearRecipeCache( subPanelContext, false );
};

export let getSubsetInfoSoaInput = function( occContext ) {
    var productContextInfoUID = occContext.productContextInfo.uid;
    var subsetInputs = [ {
        productInfo: {
            type: 'Awb0ProductContextInfo',
            uid: productContextInfoUID
        },
        requestPref: {},
        searchFilterFieldSortType: '',
        searchSortCriteria: []
    } ];
    if( appCtxSvc.ctx[ _contextKey ].isShowConnection === true ) {
        subsetInputs[ 0 ].requestPref.includeConnections = _TRUE;
    }
    return subsetInputs;
};

var initializeSearchStateFromSoaResponse = function( searchState, subPanelContext, searchFilterCategories, searchFilterMap, recipe, processCategories ) {
    let newSearchState = {};
    if( !subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature &&
          searchFilterCategories && searchFilterCategories.length > 0 && searchFilterMap ) {
        newSearchState = updateFilterInfo( searchState, searchFilterCategories, searchFilterMap, recipe,
            processCategories );
    }

    processRecipeFromSubsetResponse( recipe, subPanelContext );

    if( subPanelContext.sharedData.autoApply ) {
        newSearchState.autoApplyFilters = true;
    } else {
        newSearchState.autoApplyFilters = false;
    }
    newSearchState.searchInProgress = false;
    return newSearchState;
};

export let processGetSubsetInfoSoaResponse = ( response, searchState, subPanelContext ) => {
    if( response && response.filterOut && response.filterOut.length > 0 ) {
        return initializeSearchStateFromSoaResponse( searchState, subPanelContext, response.filterOut[ 0 ].searchFilterCategories, response.filterOut[ 0 ].searchFilterMap, response.filterOut[ 0 ].recipe,
            true );
    }
};

export let getRecipeStateFromSoa = ( response, searchState, recipeState, sharedData, occContext ) => {
    if( response && response.filterOut && response.filterOut.length > 0 ) {
        recipeState.recipe = response.filterOut[ 0 ].recipe;
    }
    if( sharedData && sharedData.recipeTermToAdd && sharedData.recipeTermToAdd.criteriaType === 'SelectedElement' ) {
        let response = updateSearchStateOnPanelLoad( searchState, recipeState, sharedData, occContext );
        if( response ) {
            return response.recipeState;
        }
    }

    return recipeState;
};

export let updateSearchStateAfterFilterAction = ( filter, category, updateAtomicData, searchState, recipeState, sharedData, occContext ) => {
    if( !validForFilterChange( updateAtomicData, searchState, recipeState, filter ) ) {
        return;
    }


    if( searchState.categories && searchState.categories.length > 0 ) {
        // New filter map and filter string generation after filter selection
        const updateSearchStateAtomicData = updateAtomicData.searchState;
        const updateRecipeStateAtomicData = updateAtomicData.recipeState;
        const selectedFiltersMap = getSelectedFiltersMap( searchState.categories );
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
        const newFilterString = searchFilterService.buildFilterString( selectedFiltersMap );
        let activeFiltersInfo = searchCommonUtils.createActiveFiltersFromActiveFilterMap( selectedFiltersInfo.activeFilterMap );
        let activeFilters = activeFiltersInfo.activeFilters;
        if( searchState.filterString !== newFilterString && !( _.isEmpty( newFilterString ) && searchState.filterString === undefined ) ) {
            let filterRecipe = generateRecipeFromSelectedFilters( filter, category, recipeState.recipe );
            if( searchState.autoApplyFilters && !_.isEmpty( searchState.filterString ) && _.isEmpty( newFilterString ) && recipeState.recipe && recipeState.recipe.length === 1 ) {
                // recipe is being cleared
                filterRecipe = generateRecipeWithClearOperator( searchState.filterString, searchState.categories );
            }
            if( searchState.autoApplyFilters ) {
                let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
                updateSearchStateAtomicData( newSearchState );
                applyFilter( filterRecipe, occContext );
                return;
            }

            // sync filters to update the cache and view model
            var modifiedCategories;
            if( category.type === filterPanelUtils.DATE_FILTER ) {
                // Re-evaluate category toggle visibility
                modifiedCategories = getCategoriesWithUpdatedCategoryLogicAfterFilterChange( searchState.categories, filterRecipe );
                // Modify cache with update filter and category logic information
                modifiedCategories = syncDateFiltersInCacheOnFilterChange( modifiedCategories, searchState.colorToggle, category, filter );
                updateSearchStateAfterFilterChange( searchState, updateAtomicData, modifiedCategories, null );
            } else {
                // Re-evaluate category toggle visibility
                modifiedCategories = getCategoriesWithUpdatedCategoryLogicAfterFilterChange( searchState.categories, filterRecipe );
                // Modify cache with update filter and category logic information
                modifiedCategories = syncFiltersInCacheOnFilterChange( modifiedCategories, category, filter );
                updateSearchStateAtomicData( {
                    ...searchState,
                    filterString: newFilterString,
                    categories: modifiedCategories,
                    activeFilters: activeFilters,
                    activeFilterMap: selectedFiltersInfo.activeFilterMap
                } );
            }

            // sync recipes in cache to update the view model
            var recipeUpdateObj = updateRecipesInCache( sharedData );
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = recipeUpdateObj[1];
            sharedData.update && sharedData.update( newSharedData );
            updateRecipeStateAtomicData( { ...recipeState, recipe: filterRecipe } );
        }
    }
};

var clearCategoriesFromSearchStateBeforeApplyingFilters = function( ) {
    let newSearchState = {};
    newSearchState.searchInProgress = true;
    return newSearchState;
};


var generateRecipeWithClearOperator = function( filterString, categories ) {
    let recipeList = [];
    let values = filterString.split( '=' );

    let selectedCategory = null;
    // Find Selected Category
    for( let j = 0; j < categories.length; j++ ) {
        if( categories[ j ].internalName === values[ 0 ] || categories[ j ].type === 'DateFilter' && values[ 0 ].startsWith( categories[ j ].internalName ) ) {
            selectedCategory = categories[ j ];
            break;
        }
    }

    if( selectedCategory !== null ) {
        let recipe = {
            criteriaDisplayValue: selectedCategory.displayName + '_$CAT_' + values[ 1 ],
            criteriaOperatorType: 'Clear',
            criteriaType: selectedCategory.categoryType,
            criteriaValues: [ values[ 1 ] ],
            subCriteria: []
        };
        recipeList.push( recipe );
    }

    return recipeList;
};

var generateRecipeFromSelectedFilters = function( selectedFilter, categoryOfSelectedFilter, currentRecipe ) {
    cloneCurrentRecipesIfNeeded();

    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    var productContextInfoUID = occMgmtCtx.productContextInfo.uid;
    var transientRecipes = lookupRecipesInfoInCache( productContextInfoUID );
    var foundInTransientRecipe = findFilterInTransientRecipeList( transientRecipes, selectedFilter );

    var clonedRecipe = _.cloneDeep( currentRecipe );

    if( selectedFilter.selected.value ) {
        // User is selecting the filter.
        // Create a new criteria and update the cache if it is already not in current recipe list
        var recipeToAdd = createRecipeForGivenCategory( categoryOfSelectedFilter, selectedFilter, clonedRecipe );
        clonedRecipe = addRecipeToCacheForCurrentPCI(  clonedRecipe, recipeToAdd );
    } else {
        // User is deselecting the filter. Remove it from transient recipe list
        if( foundInTransientRecipe ) {
            if( transientRecipes.length > 1 && categoryOfSelectedFilter.type === filterPanelUtils.DATE_FILTER ) {
                // Remove the orphan dates from the transient recipe for the deselected date
                var clonedFilterValues = _.cloneDeep( categoryOfSelectedFilter.filterValues );
                var dateFilterValues = getOrphanDateEntries( clonedFilterValues, selectedFilter );
                removeOrphanDatesFromRecipes( transientRecipes, dateFilterValues );
            }
            if( transientRecipes.length === 1 && transientRecipes[ 0 ].criteriaValues.length === 2 ) {
                // The last recipe is being deselected
                transientRecipes[ 0 ].criteriaOperatorType = 'Clear';
                // Update view model recipe
                clonedRecipe = [];
            } else {
                if( foundInTransientRecipe.criteriaValues.length > 2 ) {
                    // Attribute recipe with multiple values
                    removeCriteriaValueFromCategory( foundInTransientRecipe, selectedFilter );
                } else {
                    transientRecipes.splice( transientRecipes.indexOf( foundInTransientRecipe ), 1 );
                }
                clonedRecipe = _.cloneDeep( transientRecipes );
            }
            replaceRecipesToCacheForCurrentPCI( transientRecipes );
        }
    }

    return clonedRecipe;
};

export let modifySearchStateWithUpdatedFilters = ( eventData, searchState, recipeState,  subPanelContext, updateAtomicData ) => {
    if( eventData ) {
        var occmgmtContext = appCtxSvc.getCtx( _contextKey );
        if( eventData.name === _contextKey &&
              eventData.target === 'searchFilterMap' && occmgmtContext.searchFilterMap ) {
            const newSearchState = initializeSearchStateFromSoaResponse( searchState, subPanelContext, occmgmtContext.searchFilterCategories, occmgmtContext.searchFilterMap, occmgmtContext.recipe,
                true );
            revalidateIncludeExcludeCommandVisibility( occmgmtContext.recipe );
            const newRecipeState = { ...recipeState };
            newRecipeState.recipe = occmgmtContext.recipe;
            newRecipeState.isClearAll = false;
            let updateSearchAtomicData = updateAtomicData.searchState;
            let updateRecipeAtomicData = updateAtomicData.recipeState;
            updateRecipeAtomicData( newRecipeState );
            updateSearchAtomicData( newSearchState );
        }
    }
};

export let restoreCategoriesAfterFailedConcurrentSave = function(  searchState, subPanelContext ) {
    _removeTempRecipeObjFromAppCtx( subPanelContext.occContext );
    let pciUid = subPanelContext.occContext.productContextInfo.uid;
    var soaCategoriesInfo = getRawCategoriesAndCategoryValues( pciUid );
    return initializeSearchStateFromSoaResponse( searchState, subPanelContext, soaCategoriesInfo.rawCategories,
        soaCategoriesInfo.rawCategoryValues, soaCategoriesInfo.recipe, true );
};

/**
   * To switch between discovery sub panel and structure filter panel
   * @param {Object} sharedData - shared data
   * @param {Object} occmgmtContext - current occContext object
   * @returns {Object} sharedData - updated shared data
   */
export const updateSharedActiveViewBasedOnPCI = ( sharedData, occmgmtContext ) => {
    let newSharedData;
    if( sharedData ) {
        newSharedData = sharedData && sharedData.value ? { ...sharedData.getValue() } : { ...sharedData };
    } else {
        newSharedData = {};
    }

    let currentActiveView = newSharedData.activeView;

    if( occmgmtContext && occmgmtContext.supportedFeatures && occmgmtContext.supportedFeatures.Awb0EnableSmartDiscoveryFeature ) {
        if( currentActiveView && !_resetInitiated &&  ( currentActiveView === 'ProximitySubPanel' || currentActiveView === 'BoxZoneSubPanel' ||
                    currentActiveView === 'PlaneZoneSubPanel' || currentActiveView === 'Awb0FilterPanelSettings' ) ) {
            return newSharedData;
        }
        newSharedData.activeView = 'Awb0DiscoveryFilterCommandSubPanel';
    } else {
        newSharedData.activeView = 'Awb0StructureFilterCommandSubPanel';
    }
    if( _resetInitiated ) {
        _resetInitiated = false;
    }

    return newSharedData;
};

var addSpatialRecipeInDelayMode = function( recipeToAdd, searchState ) {
    // Update selected flag for Spatial recipe and modify cached categories and values
    for( let index = 0; index < searchState.categories.length; index++ ) {
        var category = searchState.categories[ index ];
        if( category.categoryType === 'Spatial' ) {
            for( var i = 0; i < category.filterValues.length; i++ ) {
                if( category.filterValues[ i ].internalName === recipeToAdd.criteriaType ) {
                    category.filterValues[ i ].selected.dbValue = true;
                    break;
                }
            }
            break;
        }
    }
    syncFilterInfo( searchState.categories, 'SpatialSearch', recipeToAdd.criteriaType, true, true );
};

var createSearchStateFromCache = function( searchState, categories, autoApply, pciUid ) {
    let newSearchState = { ...searchState };
    var soaCategoriesInfo = getRawCategoriesAndCategoryValues( pciUid );
    var processedSearchFilterCategories = _.cloneDeep( searchCommonUtils.processOutputSearchFilterCategories( newSearchState, soaCategoriesInfo.rawCategories ) );
    newSearchState.searchFilterCategories = processedSearchFilterCategories;
    newSearchState.searchFilterMap = _.cloneDeep( soaCategoriesInfo.rawCategoryValues );
    newSearchState.objectsGroupedByProperty = { internalPropertyName: '' };
    newSearchState.bulkFiltersApplied = false;
    if( autoApply ) {
        newSearchState.autoApplyFilters = true;
    } else {
        newSearchState.autoApplyFilters = false;
    }
    newSearchState.searchInProgress = false;
    processCategoriesMetaDataForRendering( soaCategoriesInfo.rawCategoryValues, categories, false );
    newSearchState.categories = categories;
    const appliedFiltersMap = getSelectedFiltersMap( newSearchState.categories );
    const appliedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( appliedFiltersMap );
    newSearchState.appliedFilterMap = appliedFiltersInfo.activeFilterMap;
    return newSearchState;
};

var publishEventToFetchFilters = function() {
    eventBus.publish( 'filterPanel.getFilters' );
};

export let updateSearchStateOnPanelLoad = function( searchState, recipeState, sharedData, occContext ) {
    var categories = lookupCategoriesInfoInCache( occContext.productContextInfo.uid );
    if( categories ) {
        const sharedDataValue = { ...sharedData.getValue() };
        var cachedSearchState = createSearchStateFromCache( searchState, categories, sharedDataValue.autoApply, occContext.productContextInfo.uid );

        var newRecipeState = { ...recipeState };
        var [ recipesToDisplay, enableApply ] = updateRecipesInCache( sharedData );
        newRecipeState.recipe = recipesToDisplay;

        if( sharedData && sharedData.recipeTermToAdd && sharedData.recipeTermToAdd.criteriaType ) {
            var [ filterRecipe, enableFilterApply ] = addRecipe( newRecipeState, sharedData );

            const newSharedData = { ...sharedData.getValue() };
            if( newSharedData.autoApply ) {
                // Reset shared data after recipe add
                newSharedData.enableFilterApply = enableFilterApply;
                newSharedData.spatialRecipeIndexToUpdate = undefined;
                newSharedData.recipeTermToAdd = undefined;
                sharedData.update && sharedData.update( newSharedData );

                // Reset search state before filter apply
                let newSearchState = clearCategoriesFromSearchStateBeforeApplyingFilters();
                applyFilter( filterRecipe, occContext );
                return  { searchState: newSearchState, recipeState: newRecipeState };
            }

            if( isSpatialRecipe( sharedData.recipeTermToAdd ) ) {
                addSpatialRecipeInDelayMode( sharedData.recipeTermToAdd, cachedSearchState );
            }
            newSharedData.enableFilterApply = enableFilterApply;
            newSharedData.spatialRecipeIndexToUpdate = undefined;
            newSharedData.recipeTermToAdd = undefined;
            sharedData.update && sharedData.update( newSharedData );
            newRecipeState.recipe = filterRecipe;
        }else{
            const newSharedData = { ...sharedData.getValue() };
            newSharedData.enableFilterApply = enableApply;
            sharedData.update && sharedData.update( newSharedData );
        }

        let isCategoryLogicMapPopulated = false;
        let categoryLogicEntry;
        if( pciToCategoryLogicMap ) {
            categoryLogicEntry = pciToCategoryLogicMap.filter( function( x ) {
                return x.pciUid === occContext.productContextInfo.uid;
            } );
            if( categoryLogicEntry && categoryLogicEntry.length > 0 && categoryLogicEntry[ 0 ].categoryLogicMap ) {
                isCategoryLogicMapPopulated = true;
            }
        }
        // Create new category logic cache if it does not exist for given PCI
        let modifiedCategories;
        if( !isCategoryLogicMapPopulated ) {
            modifiedCategories = initializeCategoryLogicCache( cachedSearchState.categories, newRecipeState.recipe );
        } else {
            modifiedCategories = initializeCategoryLogicCache( cachedSearchState.categories, newRecipeState.recipe, categoryLogicEntry[ 0 ].categoryLogicMap );
        }
        cachedSearchState.categories = modifiedCategories;
        return { searchState: cachedSearchState, recipeState: newRecipeState };
    }

    publishEventToFetchFilters();
};

/**
   * Destroy
   */
export let destroy = function() {
    clearCache();
    clearRecipeCache( undefined, true );
    pciToCategoryLogicMap = [];
    _.forEach( discoveryFilterEventSubscriptions, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
    discoveryFilterEventSubscriptions = [];
    unregisterListeners();
};

export let setContextKey = function( key ) {
    _contextKey = key;
};

export let createFiltersDisabledMessage = function( occContext, filterDisabledMessage, showFiltersDisabledMessage ) {
    if( occContext && occContext.readOnlyFeatures.Awb0StructureFilterFeature ) {
        uwPropertySvc.setValue( showFiltersDisabledMessage, filterDisabledMessage );
        uwPropertySvc.setDisplayValue( showFiltersDisabledMessage, [ filterDisabledMessage ] );
    }

    return showFiltersDisabledMessage;
};

export let setResetInitiated = function( ) {
    _resetInitiated = true;
};

export default exports = {
    validateTermsToIncludeOrExclude,
    computeFilterStringForNewProductContextInfo,
    clearRecipeCache,
    clearCategoryLogicMap,
    performPostProcessingOnLoad,
    persistCategoryFilterToUpdateState,
    updateCategoriesAfterFacetSearch,
    applyFilter,
    processInitialDelayedApplyPreference,
    isDiscoveryIndexed,
    clearRecipe,
    initialize,
    setContextKey,
    updateSearchStateAfterFilterAction,
    processGetSubsetInfoSoaResponse,
    modifySearchStateWithUpdatedFilters,
    getSubsetInfoSoaInput,
    destroy,
    clearAllCacheOnReset,
    updateSearchStateOnPanelLoad,
    updateSharedActiveViewBasedOnPCI,
    getRecipeStateFromSoa,
    processRecipeOnUpdate,
    applyFilterInBulkMode,
    updatePartitionSchemeFacet,
    toggleCategoryLogic,
    restoreCategoriesAfterFailedConcurrentSave,
    createFiltersDisabledMessage,
    setResetInitiated
};


