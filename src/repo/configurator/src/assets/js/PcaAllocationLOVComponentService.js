// Copyright (c) 2022 Siemens

/**
 * @module js/PcaAllocationLOVComponentService
 */

import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwWidgetVal from 'viewmodel/AwWidgetValViewModel';
import _ from 'lodash';

let exports = {};

/**
 * render function for AwLovEdit
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awPcaAllocationLOVComponentRenderFunction = ( props ) => {
    const { fields, viewModel, ...prop } = props;
    let fielddata = { ...prop.fielddata };
    //there is no way to fork a default/custom renderer before, so we'll need to differentiate usages here
    if( !fielddata.hasLov ) {
        // we need to reset the rendering hint in order to use this way!
        fielddata.renderingHint = '';

        const passedProps = { ...prop, fielddata };
        return (
            <AwWidgetVal {...passedProps} ></AwWidgetVal>
        );
    }
    fielddata.isSelectOnly = false;
    fielddata.dataProvider = viewModel.dataProviders.pca0AllocationDataProvider;
    fielddata.emptyLOVEntry = false;
    // Extract search column Name i.e object_name/cfg0ObjectId from props into data, So it can be reused further.
    viewModel.data.searchColumnName = props.name;
    const passedProps = { ...prop, fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * This method is used to process the response
 * @param {Object} response response to be processed
 * @param {string} searchColumnName - column name
 * @return {Object} all the nameTypes
 */
export let processSoaResponseForBONames = function( response, searchColumnName ) {
    var searchResults = {};
    if( response.searchResultsJSON ) {
        searchResults = JSON.parse( response.searchResultsJSON );
    }
    return searchResults.objects ? searchResults.objects.map( function( vmo ) {
        let mo = response.ServiceData.modelObjects[ vmo.uid ];

        //todo add namespace value to description? 
        return {
            propDisplayValue : mo.props[searchColumnName].dbValues[ 0 ],
            propInternalValue : mo.props[searchColumnName].uiValues[ 0 ],
            mo: mo

        };
    } ) : [];
};

/**
 * This method provides parent object uid of selected object.
 * @param {object} props context for render function interpolation
 * @return {Object} - parent object uid
 */
export let getParent = function( props ) {
    return props.vmo.parentUid;
};

/**
 * This method provides Business Object name of selected object.
 * @param {object} props context for render function interpolation
 * @return {Object} Business Object type name
 */
export let getBOName = function( props ) {
    return props.vmo.type;
};

/**
 * Method for getting the search string for performSearchViewModel4 SOA
 * @param {object} selectedProps - selected properties
 * @return {String} - filterString to filter results of performSearchViewModel4 SOA
 */
export let getFilterString = function( selectedProps ) {
    //checking selectedProps
    var filterString = '';
    if( _.get( selectedProps, 'object_name.filterString' ) ) {
        filterString = selectedProps.object_name.filterString;
    } else if( _.get( selectedProps, 'cfg0ObjectId.filterString' ) ) {
        filterString = selectedProps.cfg0ObjectId.filterString;
    }
    return filterString;
};
/**
 * Get last object from JSON
 * @param {Object} response to get last uid from searchResult
 * @returns {string} returns uid as string from jsonstring
 */
export let getLastUid = function( response ) {
    if( !_.isUndefined( response.ServiceData.plain ) ) {
        const length = response.ServiceData.plain.length;
        return response.ServiceData.plain[ length - 1 ];
    }
    return '';
};

/**
 * Method for getting allocation LOV filtering data which need to be passed to performSearchViewModel4 SOA
 * @param {object} selectedProps - selected properties
 * @param {string} searchColumnName - column name
 * @return {object} - filterData Which is used to filter results of performSearchViewModel4 SOA
 */
export let getAllocationFilterData = function( selectedProps, searchColumnName ) {
    //checking selectedProps
    var filterString = [];
    // If object_name is selected extract filterstring value out of it.
    // otherwise extract from cfg0ObjectId.
    filterString[0] = selectedProps[searchColumnName].filterString ? selectedProps[searchColumnName].filterString : '';

    // Return filterData which holds information about column to be filter along with filter string value.
    return[ {
        columnName: searchColumnName,
        values: filterString,
        operation: 'contains'
    } ];
};

export default exports = {
    awPcaAllocationLOVComponentRenderFunction,
    processSoaResponseForBONames,
    getParent,
    getBOName,
    getFilterString,
    getLastUid,
    getAllocationFilterData
};

