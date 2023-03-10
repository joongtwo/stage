// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1RelationBrowserLegendService
 */
import soaSvc from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import tcVmoSvc from 'js/tcViewModelObjectService';
import _ from 'lodash';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';
import filterSvc from 'js/graphFilterService';
import filterPanelService from 'js/filterPanelService';
import adapterSvc from 'js/adapterService';
var exports = {};

var _userLocale = null;
var _unassignedString = null;

var _legendLayoutMap = null;
let _appliedFilters = {};

/**
 * Returns the aggregate date ranges allowed from the filters.
 * @param {Array} selectedFilters selected date filters
 * @returns {Array} ordered date filters
 */
const getSelectedDateRanges = function( selectedFilters ) {
    // Store the selected ranges.
    const rangeList = [];

    // Iterate through all of the filters, ordered by drilldown (descending) and then lowervalue (ascending).
    const sortedFilters = _.orderBy( selectedFilters, [ 'drilldown', 'startDateValue' ], [ 'desc', 'asc' ] );

    for( const filterValue of sortedFilters ) {
        // Find if the current filter value overlaps any of the previous ranges.
        const foundRange = _.find( rangeList, function( range ) {
            if( range.startDateValue && range.endDateValue ) {
                return range.startDateValue <= filterValue.endDateValue &&
                    filterValue.startDateValue <= range.endDateValue;
            }
            return false;
        } );

        // If not, add this to the list of selected ranges.
        if( !foundRange ) {
            rangeList.push( { startDateValue: filterValue.startDateValue, endDateValue: filterValue.endDateValue } );
        }
    }

    // Sort befre returning the ranges.
    return _.sortBy( rangeList, 'startDateValue' );
};

/**
 * Returns whether or not the date is within the selected range
 * of dates for the category.
 * @param {Array} filterValues filter values
 * @param {String} date date
 * @returns {Boolean} true if input date is within filtered date ranges, false otherwise
 */
function isDateWithinSelectedRange( filterValues, date ) {
    const selectedDate = new Date( date );
    const selectedRangeList = getSelectedDateRanges( filterValues );

    let isFound = _.isEmpty( selectedRangeList );

    for( const selectedRange of selectedRangeList ) {
        if( selectedRange.startDateValue <= selectedDate.getTime() && selectedDate.getTime() <= selectedRange.endDateValue ) {
            isFound = true;
            break;
        }
    }

    return isFound;
}

/**
 * Translates legacy direction in RB config into GC specific values
 *
 * @param {String} configDirection config direction
 * @return {string} GC specific string
 */
var translateLayout = function( configDirection ) {
    if( !_legendLayoutMap ) {
        _legendLayoutMap = new Map();
        _legendLayoutMap.set( 'Left-to-Right', 'LeftToRight' );
        _legendLayoutMap.set( 'Right-to-Left', 'RightToLeft' );
        _legendLayoutMap.set( 'Top-to-Bottom', 'TopToBottom' );
        _legendLayoutMap.set( 'Bottom-to-Top', 'BottomToTop' );
    }

    var value = configDirection;

    if( _legendLayoutMap.has( configDirection ) ) {
        value = _legendLayoutMap.get( configDirection );
    }

    return value;
};

var formatLegendViewsData = function( data ) {
    var legendViewsData = data.legendData;
    var formattedLgendViewsData = [];
    if( !legendViewsData ) {
        return [];
    }

    for( var i = 0; i < legendViewsData.length; i++ ) {
        var view = legendViewsData[ i ];
        var defaultLayout = translateLayout( view.defaultLayout );
        var formattedView = {
            displayName: view.displayName,
            internalName: view.name,
            defaultExpandDirection: view.defaultExpandDirection,
            defaultLayout: defaultLayout,
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

export let initLegendData = function( graphCtx, data, defaultActiveView ) {
    _appliedFilters = {};
    let legend = { ...data.legend };

    // checking if ctx.graph is initialized before setting legend info
    if( data.legendData && graphCtx ) {
        let legendViewsData = formatLegendViewsData( data );

        if( legendViewsData.length > 0 ) {
            //Set default view if specified in subPanelContext of RB
            if( defaultActiveView ) {
                let view = '';
                for( let i = 0; i < legendViewsData.length; i++ ) {
                    if( legendViewsData[ i ].internalName === defaultActiveView ) {
                        legendViewsData[ i ].expand = true;
                        view = legendViewsData[ i ].internalName;
                        break;
                    }
                }
                legend.defaultActiveView = view;
            } else { // Set first view as default otherwise
                legendViewsData[ 0 ].expand = true;
                legend.defaultActiveView = legendViewsData[ 0 ].internalName;
            }
        }

        // init legend
        legend.legendViews = legendViewsData;

        // the graph would set the active view eventually but not necessarily
        // before we need to access it, so we are forcing it here.
        if( !graphCtx.legendState.activeView ) {
            graphLegendSvc.initLegendActiveView( legend, graphCtx.legendState );
        }

        data.legend.update( null, legend );
        return {}; // return empty object to set actionState
    }
};

/**
 * getFilterMap
 * @param {Array} filterList list of filters
 * @returns {Object} filter map and policy
 */
export let getFilterMap = function( filterList ) {
    const filterMap = {};

    // Find Types for each item
    _.forEach( filterList, function( typeAndProperty ) {
        let typeName = 'WorkspaceObject';
        let propertyName = typeAndProperty;
        let propertyArray = [];

        if( typeAndProperty.indexOf( ':' ) > 0 ) {
            const split = typeAndProperty.split( ':' );
            typeName = split[ 0 ];
            propertyName = split[ 1 ];
        }

        if( propertyName.indexOf( ',' ) > 0 ) {
            propertyArray = propertyName.split( ',' );
        } else {
            propertyArray.push( propertyName );
        }

        if( _.has( filterMap, typeName ) ) {
            const temp = _.get( filterMap, typeName );
            propertyArray = propertyArray.concat( temp );
        }

        _.set( filterMap, typeName, propertyArray );
    } );

    let policy = [];

    try {
        for( const typeName in filterMap ) {
            if( filterMap.hasOwnProperty( typeName ) ) {
                const policyType = {
                    name: typeName,
                    properties: []
                };

                for( const propertyName of filterMap[ typeName ] ) {
                    policyType.properties.push( { name: propertyName } );
                }

                policy.push( policyType );
            }
        }
    } catch ( ex ) {
        logger.error( ex );

        policy = [ {
            name: 'WorkspaceObject',
            properties: [
                { name: 'object_type' },
                { name: 'owning_user' },
                { name: 'owning_group' },
                { name: 'release_status_list' },
                { name: 'date_released' },
                { name: 'last_mod_user' },
                { name: 'last_mod_date' }
            ]
        } ];
    }

    return {
        filterMap: filterMap,
        policy: policy
    };
};

const getFilterSelection = function( filterStateCategory, initFilters, propDesc, filterName ) {
    let selected = false;
    if( filterStateCategory ) {
        let matcher = filterName;
        if( typeof filterName === 'string' ) {
            matcher = [ 'name', filterName ];
        }
        const filterStateCategoryValue = _.find( filterStateCategory.filterValues, matcher );
        selected = _.get( filterStateCategoryValue, 'selected.dbValue', false );
    } else {
        const filterValues = initFilters[ propDesc.name ];
        selected = _.some( filterValues, _.matches( filterName ) );
    }
    return selected;
};

const addDateFilters = function( categoryValues, filterStateCategory, initFilters, propDesc, categoryFilterValueStr, origDate, drilldown ) {
    let displayValue;
    let propNameSuffix;
    let lowerValue;
    let upperValue;
    const categoryFilterValue = { ...categoryFilterValueStr };
    if( drilldown === 0 ) {
        // Month level: Month (num)
        // -> June (5)
        propNameSuffix = '_0Z0_year_month';

        displayValue = origDate.toLocaleString( _userLocale, { month: 'long' } );

        // Get the first day of the month.
        lowerValue = new Date( origDate.getFullYear(), origDate.getMonth(), 1 );

        // Setting day parameter to 0 calculates one day less than first day of the month,
        // which in this case is last day of the next month, a.k.a the last day of this month.
        upperValue = new Date( origDate.getFullYear(), origDate.getMonth() + 1, 0 );
    } else if( drilldown === 1 ) {
        // Week level: Start of week - End of week (num)
        // -> 22-28 (5)

        propNameSuffix = '_0Z0_week';

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
    } else if( drilldown === 2 ) {
        // Final level: Day, Mon Date (num)
        // -> Thursday, Jun 26 (5)
        propNameSuffix = '_0Z0_year_month_day';
        displayValue = origDate.toLocaleString( _userLocale, { weekday: 'long', month: 'short', day: 'numeric' } );

        lowerValue = _.clone( origDate );
        upperValue = _.clone( origDate );
    } else {
        // Year level: 2021
        propNameSuffix = '_0Z0_year';
        displayValue = origDate.getFullYear();

        // First day of the first (0th) month for the year of the original date.
        // Setting no hours, minutes, etc. defaults to 0.
        // In otherwords, lowerValue is the very FIRST (00:00:00:0000) millisecond of the year.
        lowerValue = new Date( origDate.getFullYear(), 0, 1 );

        // Setting month 12 calculates the first month of the following year, and similarly,
        // setting day parameter to 0 calculates one day less than first day of the month,
        // which in this case is one less than the first day of the next month of the following year,
        // a.k.a the last day of this year and at the last possible millisecond (23:59:59:9999).
        upperValue = new Date( origDate.getFullYear(), 12, 0, 23, 59, 59, 999 );
    }

    // Set the appropriate time of day for all of ranges.
    lowerValue.setHours( 0, 0, 0, 0 );
    upperValue.setHours( 23, 59, 59, 999 );

    let matcher = {
        name: displayValue,
        startDateValue: lowerValue,
        endDateValue: upperValue
    };
    if( !filterStateCategory ) {
        matcher.startDateValue = lowerValue.getTime();
        matcher.endDateValue = upperValue.getTime();
    }
    const selected = getFilterSelection( filterStateCategory, initFilters, propDesc, matcher );

    let dateFilterName = propDesc.name + propNameSuffix;

    let categoryFilterDateStrValue;
    let categoryFilterDateStrValues = categoryValues[ dateFilterName ];
    if( categoryFilterDateStrValues ) {
        categoryFilterDateStrValue = _.find( categoryFilterDateStrValues, { stringDisplayValue: displayValue } );
    }
    if( categoryFilterDateStrValue ) {
        ++categoryFilterDateStrValue.count;
    } else {
        categoryFilterValue.startDateValue = lowerValue;
        categoryFilterValue.endDateValue = upperValue;
        categoryFilterValue.stringValue = displayValue;
        categoryFilterValue.stringDisplayValue = displayValue;
        categoryFilterValue.selected = selected;

        if( categoryFilterDateStrValues ) {
            categoryFilterDateStrValues.push( categoryFilterValue );
        } else {
            _.set( categoryValues, dateFilterName, [ categoryFilterValue ] );
        }
    }
};

export let updateFilterData = async function( graphModel, graphFilters, filterState, filterMap ) {
    const graphControl = graphModel.graphControl;
    const graph = graphControl.graph;
    const allNodes = graph.getNodes();

    await soaSvc.ensureModelTypesLoaded( _.keys( filterMap ) );

    let initFilters = {};
    const filterStateCategories = _.get( filterState, 'categories', [] );
    if( _.isEmpty( filterStateCategories ) ) {
        if( !_.isEmpty( _appliedFilters ) ) {
            initFilters = _appliedFilters;
        } else if( graphFilters && graphFilters.value ) {
            initFilters = graphFilters.value;
        }
    }

    const searchFilterCategories = [];
    const categoryValues = {};

    for( let typeName in filterMap ) {
        const type = cmm.getType( typeName );

        for( let propertyName of filterMap[ typeName ] ) {
            let propDesc = type.propertyDescriptorsMap[ propertyName ];

            if( !propDesc ) {
                // Value in RV1_DARB_Filter_Properties maybe incorrect.
                logger.error( 'No property description found for \'' + propertyName + '\'.' );
                continue;
            }

            searchFilterCategories.push( {
                internalName: propDesc.name,
                displayName: propDesc.displayName,
                defaultFilterValueDisplayCount: 10
            } );

            const filterStateCategory = _.find( filterStateCategories, [ 'displayName', propDesc.displayName ] );

            // Iterate through each node and update the counts.
            for( let node of allNodes ) {
                let displayValue = _unassignedString;
                let displayValues = [];
                let property = node.model.nodeObject.props[ propertyName ];

                let propDbValue;
                if( property ) {
                    propDbValue = _.get( property, 'dbValues[0]' );
                    if( property.uiValues && property.uiValues.length > 0 && property.uiValues[ 0 ].length > 0 ) {
                        displayValues = displayValues.concat( property.uiValues );
                    }
                }
                if( _.isEmpty( displayValues ) ) {
                    displayValues.push( _unassignedString );
                }

                for( displayValue of displayValues ) {
                    let categoryFilterValue;
                    let categoryFilterValues = categoryValues[ propertyName ];
                    if( categoryFilterValues ) {
                        let matcher;
                        if( propDesc.valueType === 2 && propDbValue ) {
                            matcher = { startDateValue: propDbValue };
                        } else {
                            matcher = { stringDisplayValue: displayValue };
                        }
                        categoryFilterValue = _.find( categoryFilterValues, matcher );
                    }
                    if( categoryFilterValue ) {
                        ++categoryFilterValue.count;
                    } else {
                        let selected = getFilterSelection( filterStateCategory, initFilters, propDesc, displayValue );

                        categoryFilterValue = {
                            searchFilterType: 'StringFilter',
                            stringValue: displayValue,
                            stringDisplayValue: displayValue,
                            startDateValue: '',
                            endDateValue: '',
                            startNumericValue: 0,
                            endNumericValue: 0,
                            count: 1,
                            selected: selected,
                            startEndRange: '',
                            colorValue: ''
                        };
                        if( propDesc.valueType === 2 && propDbValue ) {
                            const categoryFilterValueStr = { ...categoryFilterValue };
                            categoryFilterValue.startDateValue = propDbValue;
                            categoryFilterValue.endDateValue = propDbValue;
                            categoryFilterValue.searchFilterType = 'DateFilter';
                            categoryFilterValue.startEndRange = '+1YEAR';

                            // also need to add a string filter
                            let origDate = new Date( propDbValue );

                            for( let drilldown = -1; drilldown < 3; ++drilldown ) {
                                addDateFilters( categoryValues, filterStateCategory, initFilters, propDesc, categoryFilterValueStr, origDate, drilldown );
                            }
                        }
                        if( categoryFilterValues ) {
                            categoryFilterValues.push( categoryFilterValue );
                        } else {
                            _.set( categoryValues, propertyName, [ categoryFilterValue ] );
                        }
                    }
                }
            }
        }
    }

    const inputForGetCategories = {
        searchFilterCategories: searchFilterCategories,
        categoryValues: categoryValues,
        colorToggle: false,
        showRange: false,
        skipUnpopulated: false,
        defaultFilterFieldDisplayCountFromSOA: searchFilterCategories.length
    };

    return filterPanelService.getCategories2( inputForGetCategories );
};

/**
 * Ensure that the properties required for filtering are present in the client cache
 * @param {Object} filterMap filter map based on preference RV1_DARB_Filter_Properties
 * @param {Object} graphModel Graph Model
 * @return {Promise} promise to load the properties in client cache if missing
 */
export let loadProperties = async function( filterMap, graphModel ) {
    const visibleNodes = graphModel.graphControl.graph.getVisibleNodes();
    const visibleObjects = _.map( visibleNodes, 'model.nodeObject' );
    const filterProperties = _.flatten( _.values( filterMap ) );

    return tcVmoSvc.getViewModelProperties( visibleObjects, filterProperties );
};

/**
 * Check if the object should be filtered out as per the legend filter
 * @param {Object} modelObject input object
 * @param {Array} legendFilters list of applied filters
 * @return {Boolean} true if the object is filtered
 */
export let isObjectFiltered = function( modelObject, legendFilters ) {
    var _isFiltered = false;
    if( modelObject && modelObject.props ) {
        // Loop through all our categories.
        for( const propName in legendFilters ) {
            const displayValues = [];
            // Get the appropriate property value for this category.
            const property = _.get( modelObject.props, propName );
            if( property && property.uiValues && property.uiValues.length > 0 &&
                property.uiValues[ 0 ].length > 0 ) {
                _.forEach( property.uiValues, function( uiVal ) {
                    displayValues.push( uiVal );
                } );
            }
            if( _.isEmpty( displayValues ) ) {
                displayValues.push( _unassignedString );
            }

            // If it's a date/time category (and not an unassigned date), check the selected range of dates.
            if( property && property.propertyDescriptor.valueType === 2 && property.dbValues && property.dbValues.length > 0 && property.dbValues[ 0 ] && property.dbValues[ 0 ].length > 0 ) {
                if( !isDateWithinSelectedRange( legendFilters[ propName ], property.dbValues[ 0 ] ) ) {
                    _isFiltered = true;
                    break;
                }
                // Otherwise check the filters.
            } else {
                // If none are selected, don't filter.
                const selectedFilterValues = legendFilters[ propName ];
                // If not, check for a matching filter.
                if( selectedFilterValues.length > 0 ) {
                    let keepNode = false;
                    for( const selectedFilterValue of selectedFilterValues ) {
                        for( const displayVal of displayValues ) {
                            if( selectedFilterValue === displayVal ) {
                                keepNode = true;
                                break;
                            }
                        }
                        if( keepNode ) {
                            break;
                        }
                    }
                    // If no filters match, hide the node.
                    if( !keepNode ) {
                        _isFiltered = true;
                        break;
                    }
                }
            }
        }
    }
    return _isFiltered;
};

export let applyFilters = function( filterState, graphFilterState ) {
    if( _.isEmpty( filterState.categories ) ) {
        return;
    }

    let reEvaluateFilterCategories = false;
    const oldFilters = _appliedFilters;
    _appliedFilters = {};

    for( const filterCategory of filterState.categories ) {
        let selectedFilterValues = [];
        for( const filterValue of filterCategory.filterValues ) {
            if( _.get( filterValue, 'selected.dbValue', false ) ) {
                let selectedFilterValue;
                if( filterCategory.type === 'DateFilter' ) {
                    selectedFilterValue = {
                        name: filterValue.name,
                        startDateValue: filterValue.startDateValue.getTime(),
                        endDateValue: filterValue.endDateValue.getTime()
                    };

                    // check if the date filter value was not selected previously
                    const filterPreviouslySelected = _.find( oldFilters[ filterCategory.internalName ], [ 'name', filterValue.name ] );
                    if( !filterPreviouslySelected ) {
                        reEvaluateFilterCategories = true;
                    }
                } else {
                    selectedFilterValue = filterValue.name;
                }

                selectedFilterValues.push( selectedFilterValue );
            } else {
                if( filterCategory.type === 'DateFilter' ) {
                    // check if the date filter value was selected previously
                    const filterPreviouslySelected = _.find( oldFilters[ filterCategory.internalName ], [ 'name', filterValue.name ] );
                    if( filterPreviouslySelected ) {
                        reEvaluateFilterCategories = true;
                    }
                }
            }
        }

        if( selectedFilterValues.length > 0 ) {
            _appliedFilters[ filterCategory.internalName ] = selectedFilterValues;
        }
    }
    graphFilterState.update( _appliedFilters );

    return {
        appliedFilters: _appliedFilters,
        updateFilters: reEvaluateFilterCategories
    };
};

export let filtersChanged = function( graphModel, newFilters, legendState, currentFilters ) {
    if( !_.isEqual( newFilters, currentFilters ) ) {
        // This is the filter function that is applied by the Graph.
        // The function is NOT executed at this time, but instead is executed
        // when filterSvc.applyFilter is called at the end of the code below...
        //
        // GC will pass the results of pervious filters for us to update
        // and we need only to determine the nodes to hide, "subtract" them
        // from the nodes we return and add them as the items to hide.
        const filterFunction = function( nodes, edges, ports, boundaries, itemsToHide ) {
            // Loop thru all the data
            _.forEach( nodes, function( node ) {
                // Never filter the root node.
                if( node.rootFlag !== true ) {
                    var nodeObject = cdm.getObject( node.model.id );
                    var _isFiltered = exports.isObjectFiltered( nodeObject, newFilters );
                    if( _isFiltered === true ) {
                        itemsToHide.push( node );
                    }
                }
            } );

            // We are using ctx.graph.legendState here.
            // LegendState.update function is not of correct type at initial load. 
            // So adding below check to fix current broken issue
            // Turn On or Off the filter indicator icon
            if( typeof legendState.update === 'function' ) {
                legendState.update( 'hasCustomFilters', itemsToHide.length > 0  );
            }

            return {
                nodes: _.difference( nodes, itemsToHide ),
                edges: edges,
                ports: ports,
                boundaries: boundaries,
                itemsToHide: itemsToHide
            };
        };

        // Remove any old filter function we contributed to GC.
        if( graphModel.rbFilter ) {
            _.pull( graphModel.filters, graphModel.rbFilter );
        }

        // Contribute our function to GC.
        graphModel.rbFilter = filterFunction;
        graphModel.filters.push( graphModel.rbFilter );

        // Trigger the graph to apply the filters.
        filterSvc.applyFilter( graphModel );
    }

    return {
        legendFilters: newFilters
    };
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

export let getUnderlyingObjectType = function( selectedObj ) {
    const targetObjs = adapterSvc.getAdaptedObjectsSync( [ selectedObj ] );
    return targetObjs && targetObjs[ 0 ].type;
};

export default exports = {
    initLegendData,
    getFilterMap,
    updateFilterData,
    loadProperties,
    isObjectFiltered,
    applyFilters,
    filtersChanged,
    getUnderlyingObjectType
};
