// Copyright 2021 Siemens Product Lifecycle Management Software Inc


import AwParseService from 'js/awParseService';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwDiscoveryRecipeChips from 'viewmodel/AwDiscoveryRecipeChipsViewModel';
import AwFilterPanel from 'viewmodel/AwFilterPanelViewModel';
import AwPanelHeader from 'viewmodel/AwPanelHeaderViewModel';
import AwLayoutSlot from 'viewmodel/AwLayoutSlotViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwSeparator from 'viewmodel/AwSeparatorViewModel';
import AwLabel from 'viewmodel/AwLabelViewModel';
import { EnableWhen } from 'js/hocCollection';

const AwButtonEnableWhen = EnableWhen( AwButton );


/**
 * render function for Awb0DiscoveryFilterCommandSubPanel
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awDiscoveryFilterPanelRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { viewModel: { data, dataProviders, dispatch, conditions, selectionModels, chartProviders, ports  }, ctx, actions, fields, i18n, formProp, viewPath  } = props;
    data = { ...data, dataProviders };
    if( subPanelContext && subPanelContext.fields ) {
        fields = { ...fields, ...subPanelContext.fields };
    }
    let hasRecipe = fields.recipeState && fields.recipeState.recipe && fields.recipeState.recipe.length > 0;
    const selectFilterAction = ( filter, category ) => {
        dispatch( { path: 'data.filter', value: filter } );
        dispatch( { path: 'data.category', value: category } );
        actions.updateSearchStateAfterFilterAction();
    };

    const facetSearchAction = ( categoryForFacetSearchInput, category ) => {
        dispatch( { path: 'data.facetCategorySearchInput', value: categoryForFacetSearchInput } );
        dispatch( { path: 'data.facetCategory', value: category } );
        if( category.categoryType === 'Partition' && ( categoryForFacetSearchInput.facetSearchString === undefined || !category.expand ) ) {
            actions.updatePartitionSchemeFacet();
        } else{
            actions.performFacetSearch();
        }
    };

    const excludeCategoryAction = ( category, excludeCategoryToggleValue ) => {
        dispatch( { path: 'data.excludeCategoryToggleValue', value: excludeCategoryToggleValue } );
        dispatch( { path: 'data.excludeCategory', value: category } );
        actions.toggleCategoryLogic();
    };

    return (
        < >
            <AwPanelHeader>
                <AwLayoutSlot name='Awb0ContextFeature_ContextInFilter'>
                </AwLayoutSlot>
            </AwPanelHeader>
            <AwPanelBody scrollable='false'>


                { hasRecipe &&
                <AwDiscoveryRecipeChips enableChips={!subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature} recipeObject={fields.recipeState}>
                </AwDiscoveryRecipeChips>
                }

                { hasRecipe &&
                <AwSeparator></AwSeparator>

                }

                { subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature &&
                    <div className='sw-row aw-filter-italicText'>
                        <div className='sw-column'>
                            <AwLabel {...fields.showFiltersDisabledMessage}></AwLabel>
                        </div>
                    </div>
                }

                { !subPanelContext.occContext.readOnlyFeatures.Awb0StructureFilterFeature &&
                    <AwFilterPanel subPanelContext={{ searchState:fields.searchState }} selectFilterCallBack={selectFilterAction} stringFacetCallBack={facetSearchAction}
                        excludeCategoryCallBack={excludeCategoryAction}>
                    </AwFilterPanel>
                }
            </AwPanelBody>
            { !subPanelContext.sharedData.autoApply && !subPanelContext.sharedData.hideFilterApply && fields.searchState && fields.searchState.categories && fields.searchState.categories.length > 0 &&
            <AwPanelFooter>
                <br>
                </br>
                <AwButtonEnableWhen size='auto' action={actions.applyFilter} enableWhen={subPanelContext.sharedData.enableFilterApply}>
                    <AwI18n>
                        {i18n.filterButtonTitle}
                    </AwI18n>
                </AwButtonEnableWhen>
            </AwPanelFooter>
            }
        </>
    );
};

