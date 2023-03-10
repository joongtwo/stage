// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Show Report related method execution only.
 *
 * @module js/landingPageReportService
 */
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import filtrPanelSrvc from 'js/filterPanelService';
import awChartDataProviderService from 'js/awChartDataProviderService';
import _ from 'lodash';
import landingPgSrvcUtil from 'js/landingPageServiceUtil';

var exports = {};
var arrayOfSeriesDataForChart = [];
var keyValueDataForChart = [];

var localTextBundle = null;

/**
 * processFinalColumnsForChart
 *
 * @function processFinalColumnsForChart
 * @param {ObjectArray} searchFilterColumns5 searchFilterColumns5
 * @returns {ObjectArray} processed final columns
 */
export let processFinalColumnsForChart = function( searchFilterColumns5 ) {
    return searchFilterColumns5.map( function( option ) {
        //Add an extension to date filters
        option.internalExtension = awChartDataProviderService.getFilterExtension( option );
        //Give a label and value
        option.value = option.count;
        option.label = option.stringDisplayValue;
        //Append a checkmark if the filter is active
        if( option.selected ) {
            option.label = '\u2713 ' + option.label;
        }
        return option;
    } );
};

/**
 * processUnassignedColumnsForChart
 *
 * @function processUnassignedColumnsForChart
 * @param {ObjectArray} dataPointsChart dataPointsChart
 */
export let processUnassignedColumnsForChart = function( dataPointsChart ) {
    _.forEach( dataPointsChart, function( option ) {
        if( option.stringValue === '$NONE' && option.stringDisplayValue === '' ) {
            option.stringDisplayValue = localTextBundle.noFilterValue;
        }
    } );
};

/**
 * createChartFromArrayOfSeriesInternal
 *
 * @function createChartFromArrayOfSeriesInternal
 * @param {ObjectArray} searchResultFilters searchResultFilters
 * @param {ObjectArray} filterCategories filterCategories
 * @param {Object} filterMap filterMap
 * @param {Object} reportConfig reportConfig
 * @returns {ObjectArray} array series for entire chart
 */
export let createChartFromArrayOfSeriesInternal = function( searchResultFilters, filterCategories, filterMap, reportConfig ) {
    arrayOfSeriesDataForChart = [];
    keyValueDataForChart = [];
    var internalNameData;
    var searchFilterColumns3 = [];

    // Programatic generation of series
    var searchFilterName = Array.isArray( reportConfig.ChartPropInternalName ) ? reportConfig.ChartPropInternalName[ 0 ] : reportConfig.ChartPropInternalName;
    keyValueDataForChart = [];
    _.forEach( filterCategories, function( category ) {
        // extract internal data for appropriate category to use later
        if( category.internalName === searchFilterName ) {
            internalNameData = category;
        }
    } );

    if( internalNameData === undefined || filterMap === undefined ) {
        return arrayOfSeriesDataForChart;
    }

    //Merge filters that have multiple keys (typically date filters)
    var groupedFilters = awChartDataProviderService.groupByCategory( filterMap );

    //Create a column for each filter option in that category
    var searchFilterColumns1 = groupedFilters[ internalNameData.internalName ];

    searchFilterColumns3 = [];
    // if no searchResultFilters no need to filter out results
    var count = 1;

    if( searchResultFilters !== undefined && searchResultFilters.length !== 0 ) {
        // need to check filter matched column category
        _.every( searchResultFilters, function( searchFilter ) {
            var columnFound = false;
            if( searchFilter.searchResultCategoryInternalName === internalNameData.internalName ) {
                _.forEach( searchFilterColumns1, function( column ) {
                    // filtering from selected columns when filter should apply to category
                    if( column.selected ) {
                        searchFilterColumns3.push( column );
                        columnFound = true;
                    }
                } );

                //check if columns found, if true- don't need to process other filters break the loop.
                if( columnFound ) {
                    //returning false to break
                    return false;
                }
                return true;
            } else if( count === searchResultFilters.length ) {
                // condition to add those that do not need to be filtered out
                // if there are no filters left but there is data still, we need to add it to graph
                _.forEach( searchFilterColumns1, function( column ) {
                    searchFilterColumns3.push( column );
                } );
                return false; // so that every() will break
            }
            count++;
            return true;
        } );
    } else {
        // if nothing has to be filtered out:
        searchFilterColumns3 = searchFilterColumns1;
    }
    var dataPointsChart = searchFilterColumns3;

    //Remove non string filter values
    //The "merged" date filters will be string filters
    if( internalNameData.type === 'DateFilter' ) {
        var searchFilterColumns2 = searchFilterColumns1.filter( function( option ) {
            return option.searchFilterType === 'StringFilter';
        } );
        searchFilterColumns3 = [];
        _.forEach( internalNameData.filterValues, function( searchFilter ) {
            _.forEach( searchFilterColumns2, function( option ) {
                if( option.stringValue === searchFilter.internalName ) {
                    searchFilterColumns3.push( option );
                }
            } );
        } );
        dataPointsChart = searchFilterColumns3;
        // case for numeric filter
    } else if( internalNameData.type === 'NumericFilter' ) {
        var isRangeFilter = false;
        searchFilterColumns3 = searchFilterColumns1.filter( function( option ) {
            if( option.startEndRange === 'NumericRange' ) {
                isRangeFilter = true;
            }
            return option.startEndRange !== 'NumericRange';
        } );
        if( isRangeFilter ) {
            dataPointsChart = searchFilterColumns3;
        }
    }
    //  should handle NONE values still
    exports.processUnassignedColumnsForChart( dataPointsChart );
    //Build a column for each of the remaining filters
    dataPointsChart = exports.processFinalColumnsForChart( dataPointsChart );

    //This is additional processing in case of Date filter..
    //We need to keep only leaf level columns which are not selected. Like Keep only Month if YEAR is also available.
    //One more additional step required when leaf level Day value filter is applied.
    //Only selected Day value should be shown on chart.
    var reportSearchInfo = appCtxService.getCtx( landingPgSrvcUtil.getReportsCtxSearchInfo() );
    var dayFilterApplied = false;
    if( reportSearchInfo && reportSearchInfo.activeFilterMap.hasOwnProperty( searchFilterName + '_0Z0_year_month_day' ) ) {
        dayFilterApplied = true;
    }
    if( internalNameData.type === 'DateFilter' ) {
        dataPointsChart = dataPointsChart.filter( function( dataPoint ) {
            if( dayFilterApplied && dataPoint.internalExtension === '_0Z0_year_month_day' ) {
                return dataPoint.selected;
            }
            return !dataPoint.selected;
        } );
    }

    // for every data point create a label and value
    for( var i = 0; i < dataPointsChart.length; i++ ) {
        keyValueDataForChart.push( {
            label: dataPointsChart[ i ].stringDisplayValue,
            name: dataPointsChart[ i ].stringDisplayValue,
            value: dataPointsChart[ i ].count
        } );
    }
    // push series of datapoints to entire chart series array
    arrayOfSeriesDataForChart.push( {
        seriesName: Array.isArray( reportConfig.ChartPropName ) ? reportConfig.ChartPropName[ 0 ] : reportConfig.ChartPropName,
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

export let callRepGetCategories = function( response ) {
    var categories = response.searchFilterCategories;
    var categoryValues = response.searchFilterMap6;
    var groupByProperty = response.objectsGroupedByProperty.internalPropertyName;
    var searchResultFilters = [];
    categories.refineCategories = [];
    categories.navigateCategories = [];
    var contextObject = appCtxService.getCtx( 'ReportsContext.searchIncontextInfo' );
    if( contextObject === undefined ) { contextObject = {}; }

    _.forEach( categories, function( category, index ) {
        filtrPanelSrvc.getCategories2Int( category, index, categories, categoryValues, groupByProperty, false, true, true, contextObject, searchResultFilters );
    } );

    contextObject.searchResultFilters = searchResultFilters;
    contextObject.searchFilterCategories = categories;

    appCtxService.updatePartialCtx( 'ReportsContext.searchIncontextInfo', contextObject );

    return categories;
    //return searchCommonUtils.callGetCategories( response );
};

var loadConfiguration = function() {
    localeService.getTextPromise( 'SearchMessages', true ).then(
        function( localTextBundle_ ) {
            localTextBundle = localTextBundle_;
        } );
};

loadConfiguration();

export default exports = {
    createChartFromArrayOfSeriesInternal,
    processFinalColumnsForChart,
    processUnassignedColumnsForChart,
    callRepGetCategories
};
