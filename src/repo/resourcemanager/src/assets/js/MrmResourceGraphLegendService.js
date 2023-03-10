// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphLegendService
 */
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import tcVmoService from 'js/tcViewModelObjectService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';
import filterSvc from 'js/graphFilterService';

var exports = {};

var _userLocale = null;
var _unassignedString = null;

/**
 * Retrieve the list of properties used for filtering
 * @param {Object} ctx app context
 * @param {Object[]} filterList GC filter
 * @return {String[]} list of properties used in filter
 */
function _getFilterProperties( ctx, filterList ) {
    var filterMap = exports.getFilterMap( ctx, filterList );

    var properties = [];
    var appendPropArray = function( propertyName ) {
        properties.push( propertyName );
    };

    for( var typeName in filterMap ) {
        if( filterMap.hasOwnProperty( typeName ) ) {
            _.forEach( filterMap[ typeName ], appendPropArray );
        }
    }

    return properties;
}

/**
 * Returns the aggregate date ranges allowed from the filters.
 */
var getSelectedDateRanges = function( filterValues ) {
    // Store the selected ranges.
    var rangeList = [];

    // We care only for the selected filters.
    var selectedFilters = _.filter( filterValues, 'selected', true );

    // Iterate through all of the filters, ordered by drilldown (descending) and then lowervalue (ascending).
    var sortedFilters = _.orderBy( selectedFilters, [ 'drilldown', 'lowerValue' ], [ 'desc', 'asc' ] );

    _.each( sortedFilters, function( filterValue ) {
        // Find if the current filter value overlaps any of the previous ranges.
        var foundRange = _.find( rangeList, function( range ) {
            if( range.lowerValue && range.upperValue ) {
                return range.lowerValue.getTime() <= filterValue.upperValue.getTime() &&
                    filterValue.lowerValue.getTime() <= range.upperValue.getTime();
            }

            return false;
        } );

        // If not, add this to the list of selected ranges.
        if( !foundRange ) {
            rangeList.push( { lowerValue: filterValue.lowerValue, upperValue: filterValue.upperValue } );
        }
    } );

    // Sort befre returning the ranges.
    return _.sortBy( rangeList, 'lowerValue' );
};

/**
 * Returns whether or not the date is within the selected range
 * of dates for the category.
 */
function isDateWithinSelectedRange( category, date ) {
    var selectedDate = new Date( date );
    var selectedRangeList = getSelectedDateRanges( category.filterValues );

    var isFound = false || _.isEmpty( selectedRangeList );

    _.each( selectedRangeList, function( selectedRange ) {
        if( selectedRange.lowerValue.getTime() <= selectedDate.getTime() && selectedDate.getTime() <= selectedRange.upperValue.getTime() ) {
            isFound = true;
            return;
        }
    } );

    return isFound;
}

var formatLegendViewsData = function( data ) {
    var legendViewsData = data.legendData;
    var formattedLgendViewsData = [];
    if( !legendViewsData ) {
        return [];
    }

    for( var i = 0; i < legendViewsData.length; i++ ) {
        var view = legendViewsData[ i ];
        var formattedView = {
            displayName: view.displayName,
            internalName: view.name,
            expand: false,
            showExpand: true,
            categoryTypes: []
        };

        var groups = view.groups;
        if( groups ) {
            for( var j = 0; j < groups.length; j++ ) {
                var group = groups[ j ];
                var categoryType = {
                    internalName: group.name,
                    categories: []
                };

                // The display name is derived from the categoryType.internalName (group.name above) as it maps
                // to the localized i18n string defined in ...Messages.json and referenced in ...ViewModel.json.
                // If there is no mapping, provide a fallback.
                categoryType.displayName = data.i18n[ categoryType.internalName ];
                if( typeof categoryType.displayName !== 'string' ) { // if no mapping...
                    if( categoryType.internalName === 'objects' ) {
                        categoryType.displayName = data.i18n.objects;
                    } else if( categoryType.internalName === 'relations' ) {
                        categoryType.displayName = data.i18n.relations;
                    }
                    if( typeof categoryType.displayName !== 'string' ) { // if still no mapping...
                        categoryType.displayName = data.i18n.objects;
                        logger.error( 'Setting up Legend View Categories: Failed to find localized text for category type: ' + categoryType.internalName + '.  Using \'' + data.i18n.objects + '\'.' );
                    }
                }

                var filters = group.filters;
                if( filters ) {
                    for( var k = 0; k < filters.length; k++ ) {
                        var filter = filters[ k ];
                        var category = {
                            internalName: filter.name,
                            displayName: filter.displayName,
                            categoryType: group.name,
                            isFiltered: false,
                            creationMode: 0,
                            isAuthorable: true,
                            style: {
                                borderWidth: '1px',
                                borderStyle: 'solid'
                            },
                            subCategories: []
                        };

                        category.style.color = graphLegendSvc.colorTemplate( filter.color );
                        category.style.borderColor = category.style.color;
                        var types = filter.types;
                        if( types ) {
                            for( var l = 0; l < types.length; l++ ) {
                                var type = types[ l ];
                                var subCategory = {
                                    internalName: type.internalName,
                                    displayName: type.displayName,
                                    categoryType: category.categoryType,
                                    creationMode: 0
                                };
                                category.subCategories.push( subCategory );
                            }
                        }
                        categoryType.categories.push( category );
                    }
                }
                formattedView.categoryTypes.push( categoryType );
            }
        }

        // order the category types by grouping them together
        var orderedCategoryTypes = [];
        var appendCategoryTypesObjects = function( categoryType ) {
            if( categoryType.internalName === 'objects' ) {
                orderedCategoryTypes.push( categoryType );
            }
        };

        var appendCategoryTypesRelations = function( categoryType ) {
            if( categoryType.internalName === 'relations' ) {
                orderedCategoryTypes.push( categoryType );
            }
        };

        _.forEach( formattedView.categoryTypes, appendCategoryTypesObjects );

        _.forEach( formattedView.categoryTypes, appendCategoryTypesRelations );

        formattedView.categoryTypes = orderedCategoryTypes;
        formattedLgendViewsData.push( formattedView );
    }
    return formattedLgendViewsData;
};

export let initLegendData = function( ctx, data, contextKey ) {
    if( data.legendData ) {
        var legendViewsData = formatLegendViewsData( data );

        // Set first view as default
        if( legendViewsData.length > 0 ) {
            legendViewsData[ 0 ].expand = true;
            data.legend.defaultActiveView = legendViewsData[ 0 ].internalName;
        }

        // init legend
        data.legend.legendViews = legendViewsData;

        // the graph would set the active view eventually but not necessarily
        // before we need to access it, so we are forcing it here.
        if( !ctx.graph.legendState.activeView ) {
            graphLegendSvc.initLegendActiveView( data.legend, ctx.graph.legendState );
        }

        const occMgmtContext = appCtxService.getCtx( contextKey );
        if ( occMgmtContext.resourceLoadResult ) {
            // resource data is loaded, publish "MrmResourceGraph.legendInitialized" event. It draws resource graph.
            eventBus.publish( 'MrmResourceGraph.legendInitialized' );
        } else {
            // resource data is not loaded yet, need to reinitia
            const graphCtx = appCtxService.getCtx( 'graph' );
            let newGraphCtx = { ...graphCtx };
            newGraphCtx.reInitializedLegendData = true;
            appCtxService.updateCtx( 'graph', newGraphCtx );
        }
    }
};

/**
 * getFilterMap
 */
export let getFilterMap = function( ctx, filterList ) {
    var filterMap = {};

    // Return stored filter list
    if( ctx.graph.legendData.filterMap ) {
        return ctx.graph.legendData.filterMap;
    }

    // Find Types for each item
    _.forEach( filterList, function( typeAndProperty ) {
        var typeName = 'WorkspaceObject';
        var propertyName = typeAndProperty;
        var propertyArray = [];

        if( typeAndProperty.indexOf( ':' ) > 0 ) {
            var split = typeAndProperty.split( ':' );
            typeName = split[ 0 ];
            propertyName = split[ 1 ];
        }

        if( propertyName.indexOf( ',' ) > 0 ) {
            propertyArray = propertyName.split( ',' );
        } else {
            propertyArray.push( propertyName );
        }

        if( _.has( filterMap, typeName ) ) {
            var temp = _.get( filterMap, typeName );
            propertyArray = propertyArray.concat( temp );
        }

        _.set( filterMap, typeName, propertyArray );
    } );

    var graphCtx = appCtxService.getCtx( 'graph' );
    let newGraphCtx = { ...graphCtx };
    newGraphCtx.legendData.filterMap = filterMap;
    appCtxService.updateCtx( 'graph', newGraphCtx );

    return filterMap;
};

/**
 * updateDateFilter
 *
 * Dates behave a little differently such that they expand or collapse to allow
 * showing more detailed date ranges.
 */
var updateDateFilter = function( category, selectedFilter ) {
    // Need to expand the current filter to the next level.
    if( selectedFilter.selected ) {
        if( selectedFilter.drilldown !== 'undefined' && selectedFilter.drilldown >= 0 ) {
            for( var x = 0; x < selectedFilter.internalValue.length; ++x ) {
                var origDate = selectedFilter.internalValue[ x ];
                var lowerValue;
                var upperValue;
                var displayValue;

                // Month level: Month (num)
                // -> June (5)
                if( selectedFilter.drilldown === 0 ) {
                    displayValue = origDate.toLocaleString( _userLocale, { month: 'long' } );

                    // Get the first day of the month.
                    lowerValue = new Date( origDate.getFullYear(), origDate.getMonth(), 1 );

                    // Setting day parameter to 0 calculates one day less than first day of the month,
                    // which in this case is last day of the next month, a.k.a the last day of this month.
                    upperValue = new Date( origDate.getFullYear(), origDate.getMonth() + 1, 0 );

                    // Week level: Start of week - End of week (num)
                    // -> 22-28 (5)
                } else if( selectedFilter.drilldown === 1 ) {
                    // The first day is the day of the month - the day of the week
                    lowerValue = _.clone( origDate );
                    lowerValue.setDate( origDate.getDate() - origDate.getDay() );

                    // The last day is the first day + 6days
                    upperValue = _.clone( lowerValue );
                    upperValue.setDate( lowerValue.getDate() + 6 );

                    // If the months don't match, this means the week starts in the previous month,
                    // if so, change it to the first day of this month.
                    if( lowerValue.getMonth() !== origDate.getMonth() ) {
                        lowerValue = new Date( origDate.getFullYear(), origDate.getMonth(), 1 );
                    }

                    // If the months don't match, this means the week ends in the next month,
                    // if so, change it to the last day of this month.
                    if( upperValue.getMonth() !== origDate.getMonth() ) {
                        upperValue = new Date( origDate.getFullYear(), origDate.getMonth() + 1, 0 );
                    }

                    displayValue = lowerValue.getDate() + ' - ' + upperValue.getDate();

                    // Final level: Day, Mon Date (num)
                    // -> Thursday, Jun 26 (5)
                } else if( selectedFilter.drilldown === 2 ) {
                    var options = { weekday: 'long', month: 'short', day: 'numeric' };

                    displayValue = origDate.toLocaleString( _userLocale, options );

                    lowerValue = _.clone( origDate );
                    upperValue = _.clone( origDate );

                    // Nothing more to expand, exit.
                } else {
                    break;
                }

                // Set the appropriate time of day for all of ranges.
                lowerValue.setHours( 0, 0, 0, 0 );
                upperValue.setHours( 23, 59, 59, 999 );

                // Check to see if a filter for this year already exists.
                // * Find existing filter that matches the drilldown, lowerValue and upperValue.
                var existingFilterValue = _.find( category.filterValues, function( filterValue ) {
                    if( filterValue.drilldown !== undefined && filterValue.drilldown === selectedFilter.drilldown + 1 &&
                        filterValue.lowerValue.getTime() === lowerValue.getTime() && filterValue.upperValue.getTime() === upperValue.getTime() ) {
                        return filterValue;
                    }
                } );

                // If not, create it.
                if( !existingFilterValue ) {
                    // Creates the filter object at drilldown level 0.
                    existingFilterValue = makeDateDrillDownValueFilter( selectedFilter.categoryName, selectedFilter.drilldown + 1, displayValue, origDate, lowerValue, upperValue, true );

                    // Store this filter on the category and resort
                    // so it appears in the correct spot (date order).
                    category.filterValues.push( existingFilterValue );
                    category.filterValues = _.sortBy( category.filterValues, 'lowerValue' );

                    // It already exists
                } else {
                    // Update the count + 1.
                    existingFilterValue.count += 1;

                    // Add this date object to the internal storage of the filter.
                    // It is used later to expand the sub-filters.
                    existingFilterValue.internalValue = existingFilterValue.internalValue.concat( origDate );
                }
            }
        }

        // Need to collapse any filter that falls within the selected filter's lower and upper bounds.
    } else {
        _.remove( category.filterValues, function( filter ) {
            return filter.drilldown > selectedFilter.drilldown &&
                filter.lowerValue >= selectedFilter.lowerValue && filter.upperValue <= selectedFilter.upperValue;
        } );
    }
};

export let updateFilterData = function( ctx, data, filterList ) {
    var graphModel = ctx.graph.graphModel;
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var visibleNodes = graph.getVisibleNodes();

    // Ensure filter tab is re-processed every time it is opened.
    _.forEach( ctx.graph.legendTabs, function( tab ) {
        if( tab.panelId === 'Rv1LegendFilterSub' ) {
            tab.recreatePanel = true;
        }
    } );

    var filterMap = exports.getFilterMap( ctx, filterList );

    var promise = soaSvc.ensureModelTypesLoaded( _.keys( filterMap ) );

    if( promise ) {
        promise.then( function() {
            var categories = [];

            // Check to see if we already have filters cached.
            if( ctx.graph.legendData.currentFilters ) {
                categories = _.clone( ctx.graph.legendData.currentFilters );
            }

            for( var typeName in filterMap ) {
                if( !filterMap.hasOwnProperty( typeName ) ) {
                    continue;
                }

                var type = cmm.getType( typeName );

                _.forEach( filterMap[ typeName ], function( propertyName ) {
                    var propDesc = type.propertyDescriptorsMap[ propertyName ];

                    if( !propDesc ) {
                        // Value in RV1_DARB_Filter_Properties maybe incorrect.
                        logger.error( 'No property description found for \'' + propertyName + '\'.' );
                        return;
                    }

                    var category = _.find( categories, function( category ) {
                        if( propDesc.displayName === category.displayName ) {
                            return category;
                        }
                    } );

                    // This category does not already exist, we need to create it.
                    if( !category ) {
                        // If this is a "date/time" type.
                        if( propDesc.valueType === 2 ) {
                            category = {
                                defaultFilterValueDisplayCount: 10,
                                displayName: propDesc.displayName,
                                internalName: propDesc.name,
                                expand: true,
                                showDateFilter: true,
                                valueType: propDesc.valueType,
                                filterValues: []
                            };
                        } else {
                            category = {
                                defaultFilterValueDisplayCount: 10,
                                displayName: propDesc.displayName,
                                internalName: propDesc.name,
                                expand: true,
                                showStringFilter: true,
                                valueType: propDesc.valueType,
                                filterValues: []
                            };
                        }

                        categories.unshift( category );
                    }

                    // Clear out this category's filter counts and internal values (if an date/time).
                    _.forEach( category.filterValues, function( filterValue ) {
                        filterValue.count = 0;

                        if( category.valueType === 2 ) {
                            filterValue.internalValue = [];
                        }
                    } );

                    // Iterate through each node and update the counts.
                    _.forEach( visibleNodes, function( node ) {
                        var existingFilterValue;
                        var displayValue = _unassignedString;
                        var property = node.appData.nodeObject.props[ propertyName ];

                        if( property && property.uiValues && property.uiValues.length > 0 && property.uiValues[ 0 ].length > 0 ) {
                            displayValue = property.uiValues[ 0 ];
                        }

                        // If this is a "date/time" type.
                        // Create ONLY the top-most year level and let the expand function take care
                        // of all the sub-filters as well as counts, etc.
                        if( propDesc.valueType === 2 && property && property.dbValues && property.dbValues.length > 0 && property.dbValues[ 0 ] && property.dbValues[ 0 ].length > 0 ) {
                            var origDate = new Date( property.dbValues[ 0 ] );

                            // Get the year of the original date (DB value).
                            displayValue = origDate.getFullYear();

                            // First day of the first (0th) month for the year of the original date.
                            // Setting no hours, minutes, etc. defaults to 0.
                            // In otherwords, lowerValue is the very FIRST (00:00:00:0000) millisecond of the year.
                            var lowerValue = new Date( origDate.getFullYear(), 0, 1 );

                            // Setting month 12 calculates the first month of the following year, and similarly,
                            // setting day parameter to 0 calculates one day less than first day of the month,
                            // which in this case is one less than the first day of the next month of the following year,
                            // a.k.a the last day of this year and at the last possible millisecond (23:59:59:9999).
                            var upperValue = new Date( origDate.getFullYear(), 12, 0, 23, 59, 59, 999 );

                            // Check to see if a filter for this year already exists.
                            // * Find existing filter that matches the drilldown (0), lowerValue and upperValue.
                            existingFilterValue = _.find( category.filterValues, function( filterValue ) {
                                if( filterValue.drilldown !== undefined && filterValue.drilldown === 0 &&
                                    filterValue.lowerValue.getTime() === lowerValue.getTime() && filterValue.upperValue.getTime() === upperValue.getTime() ) {
                                    return filterValue;
                                }
                            } );

                            // If not, create it.
                            if( !existingFilterValue ) {
                                // Creates the filter object at drilldown level 0.
                                existingFilterValue = makeDateDrillDownValueFilter( propertyName, 0, displayValue, origDate, lowerValue, upperValue, false );

                                // Store this filter on the category and resort
                                // so it appears in the correct spot (date order).
                                category.filterValues.push( existingFilterValue );
                                category.filterValues = _.sortBy( category.filterValues, 'lowerValue' );

                                // It already exists
                            } else {
                                // Update the count + 1.
                                existingFilterValue.count += 1;

                                // Add this date object to the internal storage of the filter.
                                // It is used later to expand the sub-filters.
                                existingFilterValue.internalValue = existingFilterValue.internalValue.concat( origDate );
                            }

                            // Not a "date/time" type.
                        } else {
                            // Check if a filter with the same display name already exists.
                            existingFilterValue = _.find( category.filterValues, { name: displayValue } );

                            // If not, create it.
                            if( !existingFilterValue ) {
                                // Store this filter on the category.
                                category.filterValues.push( {
                                    categoryName: propertyName,
                                    count: 1,
                                    internalValue: displayValue,
                                    name: displayValue,
                                    selected: false,
                                    showCount: true
                                } );

                                // It already exists
                            } else {
                                // Update the count + 1.
                                existingFilterValue.count += 1;
                            }
                        }
                    } );
                } );
            }

            // Now that all of the counts have been updated.
            // Iterate over every category and reapply the
            // selected filters.
            _.forEach( categories, function( category ) {
                _.forEach( _.filter( category.filterValues, 'selected', true ), function( selectedFilter ) {
                    updateDateFilter( category, selectedFilter );
                } );
            } );

            var graphCtx = appCtxService.getCtx( 'graph' );
            let newGraphCtx = { ...graphCtx };
            // Pass back the processed categories to the legend.
            newGraphCtx.legendData.legendFilters = categories;
            // Store a cloned copy.
            newGraphCtx.legendData.currentFilters = _.clone( categories );
            appCtxService.updateCtx( 'graph', newGraphCtx );
        } );
    }
};

/**
 * Ensure that the properties required for filtering are present in the client cache
 * @param {Object} ctx application context
 * @param {Object} data view model data
 * @return {Promise} promise to load the properties in client cache if missing
 */
export let cacheProperties = function( ctx, data ) {
    var _visibleNodes = ctx.graph.graphModel.graphControl.graph.getVisibleNodes();
    var _visibleObjects = [];
    _.forEach( _visibleNodes, function( node ) {
        _visibleObjects.push( node.appData.nodeObject );
    } );
    var _filterProperties = _getFilterProperties( ctx, appCtxService.ctx.preferences.RV1_DARB_Filter_Properties );
    return tcVmoService.getViewModelProperties( _visibleObjects, _filterProperties );
};

/**
 * This function will create a filter function that the GC will use hide/show data
 * in the graph.  It will trigger the graph to apply the new filter.
 * @param {Object} ctx app context
 */
var applyFilter = function( ctx ) {
    var graphModel = ctx.graph.graphModel;

    // This is the filter function that is applied by the Graph.
    // The function is NOT executed at this time, but instead is executed
    // when filterSvc.applyFilter is called at the end of the code below...
    //
    // GC will pass the results of pervious filters for us to update
    // and we need only to determine the nodes to hide, "subtract" them
    // from the nodes we return and add them as the items to hide.
    var filterFunction = function( nodes, edges, ports, boundaries, itemsToHide ) {
        // Loop thru all the data
        _.forEach( nodes, function( node ) {
            // Never filter the root node.
            if( node.rootFlag !== true ) {
                var nodeObject = cdm.getObject( node.appData.id );
                var _isFiltered = exports.isObjectFiltered( nodeObject );
                if( _isFiltered === true ) {
                    itemsToHide.push( node );
                }
            }
        } );

        // Turn On or Off the filter indicator icon
        var graphCtx = appCtxService.getCtx( 'graph' );
        let newGraphCtx = { ...graphCtx };
        if( itemsToHide.length > 0 ) {
            newGraphCtx.legendState.hasCustomFilters = true;
        } else {
            newGraphCtx.legendState.hasCustomFilters = false;
        }

        appCtxService.updateCtx( 'graph', newGraphCtx );

        return {
            nodes: _.difference( nodes, itemsToHide ),
            edges: edges,
            ports: ports,
            boundaries: boundaries,
            itemsToHide: itemsToHide
        };
    };

    // Remove any old filter function we contributed to GC.
    _.remove( graphModel.filters, { name: 'filterFunction' } );

    // Contribute our function to GC.
    graphModel.filters.push( filterFunction );

    // Trigger the graph to apply the filters.
    filterSvc.applyFilter( graphModel );
};

/**
 * selectFilter
 *
 * This function will be called whenever the user clicks on a filter string in the Filter panel.
 */
export let selectFilter = function( ctx, data, category, selectedFilter ) {
    try {
        if( selectedFilter.selected ) {
            selectedFilter.selected = false;
        } else {
            selectedFilter.selected = true;
        }

        // If this is a "date/time" type, we need to update the hierarchy.
        if( category.valueType === 2 ) {
            updateDateFilter( category, selectedFilter );
        }

        // Apply filters.
        applyFilter( ctx );
    } catch ( ex ) {
        logger.error( ex );
    }
};

var makeDateDrillDownValueFilter = function( categoryName, drilldown, displayValue, internalValue, lowerValue, upperValue, bShowDrillDown ) {
    return {
        categoryName: categoryName,
        drilldown: drilldown,
        name: displayValue,
        internalValue: [ internalValue ],
        lowerValue: lowerValue,
        upperValue: upperValue,
        showDrilldown: bShowDrillDown,
        selected: false,
        showCount: true,
        count: 1
    };
};

/**
 * Check if the object should be filtered out as per the legend filter
 * @param {ModelObject} modelObject input object
 * @return {Boolean} true if the object is filtered
 */
export let isObjectFiltered = function( modelObject ) {
    var _isFiltered = false;
    if( modelObject && modelObject.props ) {
        // Loop through all our categories.
        _.forEach( appCtxService.ctx.graph.legendData.legendFilters, function( category ) {
            var property;
            var displayValue = _unassignedString;
            // Get the appropriate property value for this category.
            if( modelObject.props[ category.internalName ] ) {
                property = modelObject.props[ category.internalName ];
                if( property && property.uiValues && property.uiValues.length > 0 &&
                    property.uiValues[ 0 ].length > 0 ) {
                    displayValue = property.uiValues[ 0 ];
                }
            }

            // If it's a date/time category (and not an unassigned date), check the selected range of dates.
            if( category.valueType === 2 && property && property.dbValues && property.dbValues.length > 0 && property.dbValues[ 0 ] && property.dbValues[ 0 ].length > 0 ) {
                if( !isDateWithinSelectedRange( category, property.dbValues[ 0 ] ) ) {
                    _isFiltered = true;
                }
                // Otherwise check the filters.
            } else {
                // If none are selected, don't filter.
                var selectedFilters = _.filter( category.filterValues, 'selected', true );
                // If not, check for a matching filter.
                if( selectedFilters.length > 0 ) {
                    var keepNode = false;
                    for( var i = 0; i < selectedFilters.length; ++i ) {
                        if( selectedFilters[ i ].name === displayValue ) {
                            keepNode = true;
                            break;
                        }
                    }
                    // If no filters match, hide the node.
                    if( !keepNode ) {
                        _isFiltered = true;
                    }
                }
            }
        } );
    }
    return _isFiltered;
};

/**
 * Initialization
 */
const loadConfiguration = () => {
    localeSvc.getTextPromise( 'RelationBrowserMessages', true ).then(
        function( localTextBundle ) {
            _unassignedString = localTextBundle.unassigned;
        } );

    // Get the user locale in the form 'en_US'.
    _userLocale = localeSvc.getLocale();

    // Fix it up since JS expects the form 'en-US'.
    if( _userLocale !== null && !_.isUndefined( _userLocale ) ) {
        _userLocale = _userLocale.replace( /_/g, '-' );
    }

    // Default to the browser's locale.
    if( _userLocale === null ) {
        _userLocale = navigator.language || navigator.userLanguage;
    }
};

loadConfiguration();

export default exports = {
    initLegendData,
    getFilterMap,
    updateFilterData,
    cacheProperties,
    selectFilter,
    isObjectFiltered
};
