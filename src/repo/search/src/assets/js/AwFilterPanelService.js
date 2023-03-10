// Copyright (c) 2021 Siemens
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwFilterCategory from 'viewmodel/AwFilterCategoryViewModel';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwLink from 'viewmodel/AwLinkViewModel';

export const awFilterPanelRenderFunction = ( props ) => {
    const {
        fields,
        viewModel,
        subPanelContext,
        actions,
        stringFacetCallBack,
        numericRangeFacetCallBack,
        dateRangeFacetCallBack,
        bulkStringFacetCallBack,
        bulkNumericRangeFacetCallBack,
        bulkDateRangeFacetCallBack,
        selectFilterCallBack,
        excludeCategoryCallBack,
        customFacetSearchDelay
    } = props;
    let { data, dispatch } = viewModel;
    let { categorySearchString } = data;
    const categories = subPanelContext.searchState.categories;
    let categoriesToShowCount = subPanelContext.searchState.categoriesToShowCount;
    let allCategoriesVisible = subPanelContext.searchState.allCategoriesVisible;
    let categoriesFilteredByCategorySearchString = AwFilterPanelUtils.filterOutCategories( categorySearchString.dbValue, categories );

    const excludeCategoryCallBackAction = ( category, excludeCategoryToggleValue ) => {
        if( excludeCategoryCallBack ) {
            // once app teams have defined a call back, they have the responsibility of updating the searchState accordingly
            excludeCategoryCallBack( category, excludeCategoryToggleValue );
        } else {
            // if no call back, then the OOTB function will be called which will update the searchState.
            AwFilterPanelUtils.excludeCategory( subPanelContext.searchState, category, excludeCategoryToggleValue );
        }
    };

    const facetAction = ( categoryForFacetSearchInput, category ) => {
        let combinedInputData = {
            categoryForFacetSearchInput: categoryForFacetSearchInput,
            category: category
        };
        if( categoryForFacetSearchInput.isServerSearch || categoryForFacetSearchInput.hasMoreFacetValues || categoryForFacetSearchInput.zeroFiltersFound ) {
            if( stringFacetCallBack ) {
                stringFacetCallBack( categoryForFacetSearchInput, category );
            } else {
                dispatch( { path: 'data', value: { ...combinedInputData } } );
                actions.performFacetSearch();
            }
        } else if( !categoryForFacetSearchInput.isServerSearch &&
            !categoryForFacetSearchInput.hasMoreFacetValues &&
            categoryForFacetSearchInput.expanded !== true && categoryForFacetSearchInput.expanded !== false ) {
            dispatch( { path: 'data', value: { ...combinedInputData } } );
            actions.updateFacetSearchStringInCategory();
        } else {
            dispatch( { path: 'data', value: { ...combinedInputData } } );
            actions.updateExpandFlagForCategory();
        }
    };

    const numericRangeAction = ( category, startValue, endValue ) => {
        let categoryForRangeSearch = {
            category: category,
            startValue: startValue,
            endValue: endValue
        };
        if( numericRangeFacetCallBack ) {
            numericRangeFacetCallBack( categoryForRangeSearch );
        } else {
            dispatch( { path: 'data.categoryForRangeSearch', value: categoryForRangeSearch } );
            actions.updateSearchStateWithNumericRangeCriteria();
        }
    };

    const dateRangeAction = ( category, startDate, endDate ) => {
        let categoryForRangeSearch = {
            category: category,
            startValue: startDate,
            endValue: endDate
        };
        if( dateRangeFacetCallBack ) {
            dateRangeFacetCallBack( categoryForRangeSearch );
        } else {
            dispatch( { path: 'data.categoryForRangeSearch', value: categoryForRangeSearch } );
            actions.updateSearchStateWithDateRangeCriteria();
        }
    };

    const numericRangeFacetAction = ( category, startValue, endValue ) => {
        let startValue2 = startValue !== 0 ? startValue.toString() : '*';
        let endValue2 = endValue !== 0 ? endValue.toString() : '*';
        let combinedInputData = {
            category: category,
            categoryForFacetSearchInput: {
                startIndex: 0,
                startValue: startValue,
                endValue: endValue,
                facetSearchString: startValue2 === '*' && endValue2 === '*' ? '' : '[' + startValue2 + ' TO ' + endValue2 + ']',
                name: category.internalName,
                isRangeSearch: 'true'
            }
        };
        if( bulkNumericRangeFacetCallBack ) {
            bulkNumericRangeFacetCallBack( combinedInputData );
        } else {
            dispatch( { path: 'data', value: { ...combinedInputData } } );
            actions.performFacetSearch();
        }
    };

    const dateRangeFacetAction = ( category, startValue, endValue ) => {
        let combinedInputData = {
            category: category,
            categoryForFacetSearchInput: {
                startIndex: 0,
                startValue: startValue,
                endValue: endValue,
                facetSearchString: '[' + AwFilterPanelUtils.getDateRangeString( startValue, endValue ) + ']',
                name: category.internalName,
                isRangeSearch: 'true'
            }
        };
        if( bulkDateRangeFacetCallBack ) {
            bulkDateRangeFacetCallBack( combinedInputData );
        } else {
            dispatch( { path: 'data', value: { ...combinedInputData } } );
            actions.performFacetSearch();
        }
    };

    const radioAction = ( category ) => {
        let categoryForRangeSearch = {
            category: category
        };
        dispatch( { path: 'data.categoryForRangeSearch', value: categoryForRangeSearch } );
        actions.updateSearchStateForRadioFilter();
    };

    const bulkModeStringAction = ( category, facetSearchString ) => {
        let categoryForBulkStringSearch = {
            category: category,
            facetSearchString: facetSearchString
        };
        if( bulkStringFacetCallBack ) {
            bulkStringFacetCallBack( categoryForBulkStringSearch );
        } else {
            dispatch( { path: 'data', value: { ...categoryForBulkStringSearch } } );
            actions.updateSearchStateForStringFilterInBulkMode();
        }
    };

    const selectFilterCallBackAction = ( filter, category ) => {
        if( selectFilterCallBack ) {
            // once app teams have defined a call back, they have the responsibility of updating the searchState accordingly
            selectFilterCallBack( filter, category );
        } else {
            // if no call back, then the OOTB function will be called which will update the searchState.
            AwFilterPanelUtils.updateInputSearchFilterMap( filter, category, subPanelContext.searchState );
        }
    };

    const fetchEachFilterCategory = ( eachCategory, index, categoriesToShowCount ) => {
        eachCategory.expand = AwFilterPanelUtils.readExpandCollapseValueFromSearchState( eachCategory, subPanelContext.searchState );
        // render category when one of 1,2,3 is true
        // 1. current category index is less than what is specified in the preference
        // 2. Show All link is clicked.
        // 3. there is some criteria in the category searchbox
        if( categoriesToShowCount && categoriesToShowCount > 0 && index < categoriesToShowCount ||
            !categoriesToShowCount || categoriesToShowCount === 0 ||
            categorySearchString && categorySearchString.dbValue && categorySearchString.dbValue.length > 0 ||
            allCategoriesVisible ) {
            return (
                <AwFilterCategory
                    key={index}
                    category={eachCategory}
                    facetAction={facetAction}
                    numericRangeAction={numericRangeAction}
                    dateRangeAction={dateRangeAction}
                    numericRangeFacetAction={numericRangeFacetAction}
                    dateRangeFacetAction={dateRangeFacetAction}
                    radioAction={radioAction}
                    bulkModeStringAction={bulkModeStringAction}
                    selectFilterAction={selectFilterCallBackAction}
                    noResultsFoundLabel={fields.noResultsFoundLabel}
                    moreLinkProp={fields.moreLinkProp}
                    lessLinkProp={fields.lessLinkProp}
                    isBulkMode={subPanelContext.searchState && subPanelContext.searchState.autoApplyFilters === false}
                    context={subPanelContext}
                    excludeCategoryCallBackAction={excludeCategoryCallBackAction}
                    customFacetSearchDelay={customFacetSearchDelay}>
                </AwFilterCategory>
            );
        }
    };

    return (
        <div className='sw-column w-12'>
            {
                subPanelContext.searchState && subPanelContext.searchState.searchFilterCategories && subPanelContext.searchState.searchFilterCategories.length > 0 &&
                <AwPanelHeader>
                    <AwTextBox {...Object.assign( {}, fields.categorySearchString, { autocomplete:'off' } )} ></AwTextBox>
                </AwPanelHeader>
            }
            {
                subPanelContext.searchState && subPanelContext.searchState.searchInProgress &&
                <AwPanelBody className='aw-search-filterSkeleton'>
                    {
                        categories && categories.length > 0
                        && categoriesFilteredByCategorySearchString.map( ( eachCategory, index ) => fetchEachFilterCategory( eachCategory, index, categoriesToShowCount ) )
                    }
                </AwPanelBody>
            }
            {
                subPanelContext.searchState && !subPanelContext.searchState.searchInProgress &&
                <AwPanelBody>
                    {
                        categories && categories.length > 0
                        && categoriesFilteredByCategorySearchString.map( ( eachCategory, index ) => fetchEachFilterCategory( eachCategory, index, categoriesToShowCount ) )
                    }
                    {
                        // show All link is shown when 1,2,3 are all true
                        // 1. total categories length is greater than what is specified in the preference
                        // 2. there is nothing in the category search box
                        // 3. Show All is not clicked
                        categoriesToShowCount > 0 && categories && categories.length > categoriesToShowCount
                        && categorySearchString
                        && ( !categorySearchString.dbValue || categorySearchString.dbValue && categorySearchString.dbValue.length === 0 ) && !allCategoriesVisible &&
                        <AwLink className='aw-search-showAllfilterCategories' {...fields.showAllCategories} action={actions.showAllCategories}></AwLink>
                    }
                </AwPanelBody>
            }
        </div>
    );
};
