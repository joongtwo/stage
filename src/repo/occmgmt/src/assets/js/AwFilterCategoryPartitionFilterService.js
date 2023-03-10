// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/
/* eslint-disable new-cap */

/**
 * This is a service file for Partition category
 *
 * @module js/AwFilterCategoryPartitionFilterService
 */
import eventBus from 'js/eventBus';
import AwIcon from 'viewmodel/AwIconViewModel';
import { VisibleWhen } from 'js/hocCollection';
import AwPartitionLink from 'viewmodel/AwPartitionLinkViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import _ from 'lodash';

var exports = {};

const AwPartitionLinkHOC = ExtendedTooltip( AwPartitionLink );
const AwIconVisibleWhen = VisibleWhen( AwIcon );

export const awFilterCategoryPartitionFilterRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { category } = prop;
    let spaceBetweenEachFilter = 'aw-subset-spatialFilterInBetweenSpace aw-link';
    let filterValues = category.filterValues;
    let recipe = prop.ctxDeprecated.occmgmtContext.recipe;

    /*
      * Wrapper method for returning the react element comprises from AwFilterCategoryContents
      * @param {Object} eachFilter filter value
      * @param {Integer} index index value
      * @returns React element
      */
    const getFilterCategoryContents = ( filter ) => {
        const openPartitionCategoryPanel = ( event ) => {
            var panelName = 'PartitionHierarchySubPanel';
            var categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
            var selectedSchemeName = event.currentTarget.innerText;
            var selectedSchemeObj;
            for( let i = 0; i < category.filterValues.length;  ++i ) {
                if(  category.filterValues[i].name === selectedSchemeName ) {
                    selectedSchemeObj = category.filterValues[i];
                }
            }
            //Open the sub panel to set the recipe input
            var eventData = {
                nextActiveView: panelName,
                recipeOperator: categoryLogic,
                selectedObj: selectedSchemeObj,
                recipeTerm: recipe
            };
            eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
        };

        let isSchemeSelected = false;
        for( let inx = 0; inx < recipe.length; inx++ ) {
            if( filter.internalName === recipe[inx].criteriaValues[0] ) {
                isSchemeSelected = true;
            }
        }

        var ptnSchmToolTip = 'PartitionToolTip';
        if( filter.categoryName === 'Partition Scheme' ) {
            return (
                <div className={spaceBetweenEachFilter} key={_.uniqueId()} onClick={openPartitionCategoryPanel}>
                    <AwIconVisibleWhen visibleWhen={isSchemeSelected} className='aw-scheme-selectIcon' iconId='indicatorApprovedPass'></AwIconVisibleWhen>
                    <AwPartitionLink filter={filter}></AwPartitionLink>
                </div>
            );
        }
    };

    /*
      * Following method builds list of react element from given list of filter values
      * @param {Object} filterValues List of filter values
      * @returns React element
      */
    const getRow = ( filterValues ) =>{
        var filterRows = [];
        if( filterValues && filterValues.length > 0 ) {
            filterRows = filterValues.map( ( filter ) => getFilterCategoryContents( filter ) );
        }
        return filterRows;
    };

    return (
        <div>
            {
                getRow( filterValues )
            }
        </div>
    );
};

export default exports = {
    awFilterCategoryPartitionFilterRenderFunction
};

