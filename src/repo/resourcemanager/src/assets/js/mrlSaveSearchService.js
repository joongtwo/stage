// Copyright (c) 2022 Siemens

/**
 * @module js/mrlSaveSearchService
 */
import AwStateService from 'js/awStateService';
import saveSearchUtils from 'js/Awp0SaveSearchUtils';
import searchFilterSvc from 'js/aw.searchFilter.service';

var exports = {};
var SEARCH_NAME_TOKEN = 'manageResources';

/**
 * mrlExecuteFullTextSavedSearch
 * @function mrlExecuteFullTextSavedSearch
 * @param {Object}vmo - the view model object
 */
export let mrlExecuteFullTextSavedSearch = function( vmo ) {
    var criteria = vmo.props.awp0search_string.dbValue;
    let filterMap = saveSearchUtils.getFilterMap( vmo );
    const categoryToChartOn = vmo.props.awp0ChartOn.dbValues[ 0 ];

    AwStateService.instance.go( SEARCH_NAME_TOKEN, {
        filter: searchFilterSvc.buildFilterString( filterMap ),
        searchCriteria: criteria,
        secondaryCriteria: '*',
        chartBy: categoryToChartOn,
        savedSearchUid: vmo.uid
    } );
};

export let mrlExecuteImportVendorFullTextSavedSearch = function (importVendorDataModelObjects, importVendorDataInfo) {
    var importVendorDataSavedSearch;

    for (var key in importVendorDataModelObjects) {
        var object = importVendorDataModelObjects[key];
        if (object.type === 'Awp0FullTextSavedSearch' && object.uid === importVendorDataInfo.savedSearch.uid) {
            importVendorDataSavedSearch = object;
        }
    }

    if (importVendorDataSavedSearch) {
        var criteria = importVendorDataSavedSearch.props.awp0search_string.dbValues[0];
        let filterMap = saveSearchUtils.getFilterMap(importVendorDataSavedSearch);
        const categoryToChartOn = importVendorDataSavedSearch.props.awp0ChartOn.dbValues[0];

        AwStateService.instance.go(SEARCH_NAME_TOKEN, {
            filter: searchFilterSvc.buildFilterString(filterMap),
            searchCriteria: criteria,
            secondaryCriteria: '*',
            chartBy: categoryToChartOn,
            savedSearchUid: importVendorDataSavedSearch.uid
        });
    }
};

export default exports = {
    mrlExecuteFullTextSavedSearch,
    mrlExecuteImportVendorFullTextSavedSearch
};
