// Copyright (c) 2022 Siemens

/**
 * This is a service file for release box component
 *
 * @module js/AwFilterCategoryObjectFilterService
 */
import AwFilterCategoryContents from 'viewmodel/AwFilterCategoryContentsViewModel';
import AwLink from 'viewmodel/AwLinkViewModel';
import AwFilterPanelUtils from 'js/AwFilterPanelUtils';

var exports = {};

export const awFilterCategoryObjectFilterRenderFunction = ( props ) => {
    let { viewModel, fields, actions, ...prop } = props;
    let {
        category,
        facetAction,
        noResultsFoundLabel,
        moreLinkProp,
        lessLinkProp,
        selectFilterAction
    } = prop;
    let { data } = viewModel;
    let { facetSearchString, numberOfFiltersToShow } = data;

    //var filterValues = category.filterValues.childnodes;

    //category.filterValues = filterValues;
    let spaceBetweenEachFilter = 'aw-search-filterInBetweenSpace';
    let classForFilterCategoryLink = 'aw-search-filterNameLabelMore aw-base-normal';
    let filterContentInfoAfterFilteringByFacetSearchString = AwFilterPanelUtils.getFilteredResults( category.filterValues, facetSearchString.dbValue );
    const filterValsLength = filterContentInfoAfterFilteringByFacetSearchString.length;
    let filterContentInfo = AwFilterPanelUtils.restrictFilterValuesToNumberOfFiltersToShow( category, filterContentInfoAfterFilteringByFacetSearchString, numberOfFiltersToShow.dbValue );

    //get selected list and unselected list
    let filterContentInfoSelected = getSelectedList( filterContentInfo );
    let filterContentInfoUnSelected = getUnSelectedList( filterContentInfo );


    /**
     * Method returns wrapper for moreLink element.
     * @returns Wrapper for MoreLink element
     */
    const renderCategoryMoreLink = () => {
        if( filterValsLength > numberOfFiltersToShow.dbValue ) {
            return (
                <AwLink className={classForFilterCategoryLink} {...moreLinkProp} action={actions.updateNumberOfFiltersToShowForMoreLink}>
                </AwLink>
            );
        }
    };

    /**
     * Method returns wrapper for lessLink element
     * @returns Wrapper for LessLink element
     */
    const renderCategoryLessLink = () => {
        if( numberOfFiltersToShow.dbValue > category.defaultFilterValueDisplayCount ) {
            return (
                <AwLink className={classForFilterCategoryLink} {...lessLinkProp} action={actions.updateNumberOfFiltersToShowForLessLink}>
                </AwLink>
            );
        }
    };

    /**
     * Method returns the filtered list based upon selection state - true
     * @param {List} filterContentInfo List of filter values
     * @returns Return filterd list depending upon selection state
     */
    function getSelectedList( filterContentInfo ) {
        return filterContentInfo.filter( ( eachFilter ) => {
            if( eachFilter ) {
                return eachFilter.selected.checked;
            }
        } );
    }

    /**
     * Method returns the filtered list based upon selection state - false
     * @param {List} filterContentInfo List of filter values
     * @returns Return filtered list depending upon selection state
     */
    function getUnSelectedList( filterContentInfo ) {
        return filterContentInfo.filter( ( eachFilter ) => {
            if( eachFilter ) {
                return !eachFilter.selected.checked;
            }
        } );
    }

    let selectFilterCallBackAction = ( filter ) => {
        selectFilterAction( filter, category );
    };

    /**
     * Wrapper method for returning the react element comprises from AwFilterCategoryContents
     * @param {Object} eachFilter filter value
     * @param {Integer} index index value
     * @returns React element
     */
    const getFilterCategoryContents = ( eachFilter, index ) => {
        return (
            <div className={spaceBetweenEachFilter}
                title={filterContentInfo[ index ] && filterContentInfo[ index ].name ? filterContentInfo[ index ].name : ''} >
                <AwFilterCategoryContents filter={eachFilter} selectFilterCallBackAction={selectFilterCallBackAction} excludeCategory={category.excludeCategory}>
                </AwFilterCategoryContents>
            </div>
        );
    };

    /**
     * Method builds <li> from passed in filter object
     * @param {Object} filter Current filter
     * @param {Integer} index current index value for filter
     * @returns React element
     */
    const getChildUnSelected = ( filter, index ) => {
        return (
            <div className={spaceBetweenEachFilter}
                title={filterContentInfoUnSelected[ index ] && filterContentInfoUnSelected[ index ].name ? filterContentInfoUnSelected[ index ].name : ''} >
                <li key={index}>
                    <AwFilterCategoryContents filter={filter} selectFilterCallBackAction={selectFilterCallBackAction} excludeCategory={category.excludeCategory}>
                    </AwFilterCategoryContents>
                </li>
            </div>
        );
    };

    /**
     * Following method builds <ul> from given list of elements
     * @param {Object} elemList List of react elements
     * @returns React element
     */
    const getUL = ( elemList ) => {
        return(
            <ul key={elemList.length}>
                {elemList}
            </ul>
        );
    };

    /**
     * Builds selected filter value as a <li>
     * @param {Object} elem List of react elements
     * @param {Object} filter Selected filter value
     * @param {Integer} index Curret index associated with filter
     * @returns React element
     */
    const getChildSelected = ( elem, filter, index ) => {
        return(
            <li className='aw-cls-search-drill' key={filter.name}>
                <div className={spaceBetweenEachFilter}
                    title={filterContentInfoSelected[ index ] && filterContentInfoSelected[ index ].name ? filterContentInfoSelected[ index ].name : ''} >
                    <AwFilterCategoryContents filter={filter} selectFilterCallBackAction={selectFilterCallBackAction} excludeCategory={category.excludeCategory}>
                    </AwFilterCategoryContents>
                </div>
                <ul className='aw-cls-search-drillNext'>
                    {elem}
                </ul>
            </li>
        );
    };

    /**
     * Following method builds element to display from given list of elements
     * @param {Object} elemRef This is the list of react elements
     * @param {*} filter Current filter
     * @param {*} index Current index
     * @returns React element
     */
    const getRec = ( elemRef, filter, index ) => {
        var node;
        if( index !== 0 ) {
            //check last
            node = getChildSelected( elemRef, filter, index );
            return getRec( node, filterContentInfoSelected[index - 1], index - 1 );
        }

        return getUL( getChildSelected( elemRef, filter, index ) );
    };

    /**
     * Following method builds list of react element from given list of selected and unselected filter values
     * @param {Object} filterContentInfoSelected List of selected filter values
     * @param {Object} filterContentInfoUnSelected List of unselected filter values
     * @returns React element
     */
    const getRow = ( filterContentInfoSelected, filterContentInfoUnSelected ) =>{
        var arrUn = [];
        var unselectNode;
        if( filterContentInfoUnSelected.length > 0 && filterContentInfoSelected.length === 0 ) {
            arrUn = filterContentInfoUnSelected.map( ( filter, index ) => getFilterCategoryContents( filter, index ) );
            //wrap it in UL
            unselectNode = arrUn;
        } else if( filterContentInfoUnSelected.length > 0 ) {
            arrUn = filterContentInfoUnSelected.map( ( filter, index ) => getChildUnSelected( filter, index ) );
            //wrap it in UL
            unselectNode = arrUn;
        }


        if( filterContentInfoSelected.length > 0 ) {
            var selArr;
            selArr = unselectNode; //initialize
            unselectNode = getRec( selArr, filterContentInfoSelected[filterContentInfoSelected.length - 1], filterContentInfoSelected.length - 1 );
        }
        return unselectNode;
    };

    return (
        <div>
            {
                getRow( filterContentInfoSelected, filterContentInfoUnSelected )
            }
            {
                renderCategoryLessLink()
            }
            {
                renderCategoryMoreLink()
            }
        </div>
    );
};

export default exports = {
    awFilterCategoryObjectFilterRenderFunction
};
