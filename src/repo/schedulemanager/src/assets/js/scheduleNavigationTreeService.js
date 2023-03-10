// Copyright (c) 2022 Siemens

/**
 * @module js/scheduleNavigationTreeService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import assert from 'assert';
import awColumnSvc from 'js/awColumnService';
import awIconService from 'js/awIconService';
import AwPromiseService from 'js/awPromiseService';
import awSearchService from 'js/awSearchService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import searchCommonUtils from 'js/searchCommonUtils';
import smConstants from 'js/ScheduleManagerConstants';
import soaSvc from 'soa/kernel/soaService';
import treeTableDataService from 'js/treeTableDataService';
import viewModelObjectService from 'js/viewModelObjectService';
import searchFilterService from 'js/aw.searchFilter.service';
import awTableStateService from 'js/awTableStateService';
import scheduleNavigationTreeRowService from 'js/scheduleNavigationTreeRowService';
import schNavTreeNodeCreateService from 'js/scheduleNavigationTreeNodeCreateService';
import schNavTreeCellRenderingService from 'js/scheduleNavigationTreeCellRenderingService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import schNavService from 'js/scheduleNavigationService';
import eventBus from 'js/eventBus';

var exports = {};
var _treeNavigationColumnPropName = null;

var policyIOverride = {
    types: [ {
        name: 'WorkspaceObject',
        properties: [ {
                name: 'object_string'
            },
            {
                name: 'object_name'
            },
            {
                name: 'object_type'
            }
        ]
    }, {
        name: 'Schedule',
        properties: [ {
                name: 'end_date_scheduling'
            },
            {
                name: 'start_date'
            },
            {
                name: 'finish_date'
            },
            {
                name: 'fnd0SummaryTask'
            },
            {
                name: 'schedule_type'
            },
            {
                name: 'fnd0Schmgt_Lock'
            },
            {
                name: 'saw1UnitOfTimeMeasure'
            }
        ]
    }, {
        name: 'ScheduleTask',
        properties: [ {
                name: 'task_type'
            },
            {
                name: 'start_date'
            },
            {
                name: 'finish_date'
            },
            {
                name: 'duration'
            },
            {
                name: 'work_estimate'
            },
            {
                name: 'work_complete'
            },
            {
                name: 'complete_percent'
            },
            {
                name: 'fnd0status'
            },
            {
                name: 'fnd0ParentTask'
            },
            {
                name: 'schedule_tag',
                modifiers: [ {
                    name: 'withProperties', // This is to make sure sub-schedule properties are loaded for Gantt to determine if a schedule is end date schedule or not.
                    Value: 'true'
                } ]
            },
            {
                name: 'ResourceAssignment'
            },
            {
                name: 'fnd0WhatIfMode'
            },
            {
                name: 'fnd0WhatIfData'
            }
        ]
    }, {
        name: 'Fnd0ProxyTask',
        properties: [ {
                name: 'fnd0ref'
            },
            {
                name: 'fnd0task_tag',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0start_date'
            },
            {
                name: 'fnd0finish_date'
            },
            {
                name: 'fnd0type'
            },
            {
                name: 'fnd0percent_work_complete'
            },
            {
                name: 'fnd0status'
            },
            {
                name: 'fnd0WhatIfMode'
            },
            {
                name: 'fnd0WhatIfData'
            },
            {
                name: 'fnd0schedule_tag'
            }
        ]
    } ]
};

let _readOnlyColumns = [
    { typeName: 'ScheduleTask', propertyName: 'saw1RowNumberInGantt' },
    { typeName: 'ScheduleTask', propertyName: 'ResourceAssignment' },
    { typeName: 'ScheduleTask', propertyName: 'sch_task_deliverable_list' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0TaskTypeString' },
    { typeName: 'ScheduleTask', propertyName: 'task_type' },
    { typeName: 'ScheduleTask', propertyName: 'child_task_taglist' },
    { typeName: 'ScheduleTask', propertyName: 'privileged_user' },
    { typeName: 'ScheduleTask', propertyName: 'is_baseline' },
    { typeName: 'ScheduleTask', propertyName: 'original_task_tag' },
    { typeName: 'ScheduleTask', propertyName: 'schedule_tag' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0IsLegacy' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0IsSchSummaryTask' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0ParentTask' },
    { typeName: 'ScheduleTask', propertyName: 'workflow_process' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0workflow_owner' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0DaysLateFinish' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0DaysLateStart' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0DaysUntilFinish' },
    { typeName: 'ScheduleTask', propertyName: 'fnd0DaysUntilStart' }
];

/**
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeTableColumns = function( columnProvider ) {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [ {
        name: 'object_string',
        displayName: '...',
        typeName: 'WorkspaceObject',
        width: 180,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false,
        columnOrder: 100
    } ];

    var clientColumns = columnProvider && columnProvider.clientColumns ? columnProvider.clientColumns : [];
    if( clientColumns ) {
        _.forEach( clientColumns, function( column ) {
            if( column.clientColumn ) {
                awColumnInfos.push( column );
            }
        } );
    }

    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );
    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

/**
 * Create Callback function to update the properties and node icons
 *
 * @return {Object} A Object consisting of callback function.
 */
function getDataForUpdateColumnPropsAndNodeIconURLs() {
    var updateColumnPropsCallback = {};

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response, uwDataProvider ) {
        let clientColumns = uwDataProvider && !_.isEmpty( uwDataProvider.cols ) ? _.filter( uwDataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;

        exports.updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes, contextKey );

        let columnsConfig = response.output.columnConfig;
        columnsConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        var columnConfigResult = null;
        columnConfigResult = columnsConfig;

        return columnConfigResult;
    };

    return updateColumnPropsCallback;
}

/**
 * Function to update tree table columns
 *
 * @param {Object} data Contains data
 * @param {Object} dataProvider Contains data provider for the tree table
 */
export let updateSchNavTreeTableColumns = function( data, dataProvider ) {
    let output = {};
    if( dataProvider && data.newColumnConfig ) {
        var propColumns = data.newColumnConfig.columns;
        let clientColumns = !_.isEmpty( dataProvider.cols ) ? _.filter( dataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        exports.updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects() );
        data.newColumnConfig.columns = propColumns;
        dataProvider.columnConfig = data.newColumnConfig;

        // Revisit me: This should be done after updating the column config.
        // scheduleNavigationTreeRowService.loadRenderedColumnProperties();
    }
    output.newColumnConfig = data.newColumnConfig;
    output.columnConfig = dataProvider.columnConfig;
    return output;
};

/**
 * Function to update tree table columns props and icon urls
 *
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
let updateColumnPropsAndNodeIconURLs = ( propColumns, childNodes ) => {
    _.forEach( propColumns, col => {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
        // All the properties of ProxyTask are non-modifiable, as they come from the original task.
        if( col.typeName === 'Fnd0ProxyTask' ||
            _.findIndex( _readOnlyColumns, { typeName: col.typeName, propertyName: col.propertyName } ) > -1 ) {
            col.enableCellEdit = false;
            col.modifiable = false;
        }
    } );

    let firstColumn = _.filter( propColumns, ( col ) => _.isUndefined( col.clientColumn ) )[ 0 ];
    if( firstColumn.propertyName === 'saw1RowNumberInGantt' ) {
        // If first column is row number, disable the column menu (sorting, filtering), column moving and editing.
        firstColumn.enableColumnMenu = false;
        firstColumn.enableSorting = false;
        firstColumn.enableColumnMoving = false;
        if( firstColumn.columnOrder > 100 ) {
            firstColumn.columnOrder = 50;
        }

        // Make second column as tree navigation column
        let secondColumn = _.filter( propColumns, ( col ) => _.isUndefined( col.clientColumn ) )[ 1 ];
        secondColumn.isTreeNavigation = true;
        secondColumn.enableColumnHiding = false;
        _treeNavigationColumnPropName = propColumns[ 1 ].propertyName; // Assumes column value names the nodes.
        secondColumn.cellRenderers = [];
        secondColumn.cellRenderers.push( _treeCmdCellRender() );
    } else {
        // Make first column as tree navigation column
        firstColumn.isTreeNavigation = true;
        firstColumn.enableColumnHiding = false;
        _treeNavigationColumnPropName = propColumns[ 0 ].propertyName; // Assumes first column value names the nodes.
        firstColumn.cellRenderers = [];
        firstColumn.cellRenderers.push( _treeCmdCellRender() );
    }

    _.forEach( childNodes, ( childNode ) => {
        childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
        treeTableDataService.updateVMODisplayName( childNode, _treeNavigationColumnPropName );
    } );
};

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 *
 * @param {Object} eventData Contains viewModelObjects and modifiedObjects
 */
export let updateDisplayNames = function( eventData ) {
    //update the display name for all ViewModelObjects which should be viewModelTreeNodes
    if( eventData && eventData.viewModelObjects ) {
        _.forEach( eventData.viewModelObjects, function( updatedVMO ) {
            treeTableDataService.updateVMODisplayName( updatedVMO, _treeNavigationColumnPropName );
        } );
    }

    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        var loadedVMObjects = eventData.vmc.loadedVMObjects;
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            var modifiedVMOs = loadedVMObjects.filter( function( vmo ) { return vmo.id === modifiedObject.uid; } );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                treeTableDataService.updateVMODisplayName( modifiedVMO, _treeNavigationColumnPropName );
            } );
        } );
    }
};

/**
 * Process tree table properties for initial load.
 *
 * @param {Object} vmNodes loadedVMObjects for processing properties on initial load.
 * @param {Object} declViewModel data object.
 * @param {Object} uwDataProvider data provider object.
 * @param {Object} context context object required for SOA call.
 * @param {String} contextKey contextKey string for context retrieval.
 * @return {Promise} promise A Promise containing the PropertyLoadResult.
 */
export let loadTreeTablePropertiesOnInitialLoad = function( vmNodes, declViewModel, uwDataProvider, context, contextKey ) {
    var updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs();

    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTablePropertiesOnInitialLoad( vmNodes, declViewModel, uwDataProvider, context, contextKey, updateColumnPropsCallback ) );
};

/**
 * To Sync Gantt View with change in Column Filtering
 * @param {Object} eventData
 * @param {Object} scheduleNavigationContext props
 */
export let onColumnFilterApplied = function( eventData, scheduleNavigationContext ) {
    // Process only the Schedule Tree grid columns.
    if( eventData.gridId !== 'scheduleNavigationTree' ) {
        return;
    }

    // First update the column filters and then update the schedule navigation context.
    scheduleNavigationContext.update( {
        ...scheduleNavigationContext.getValue(),
        columnFilters: Array.isArray( eventData.filters ) ? eventData.filters : []
    } );
    schNavService.updateScheduleNavigationContextOnFilterChange( scheduleNavigationContext );
};

/**
 * Get a page of row column data for a tree-table.
 *
 * Note: This method assumes there is a single argument object being passed to it and that this object has the
 * following property(ies) defined in it.
 * <P>
 * {PropertyLoadInput} propertyLoadInput - (found within the 'arguments' property passed to this function) The
 * PropertyLoadInput contains an array of PropertyLoadRequest objects this action function is invoked to
 * resolve.
 *
 * @return {Promise} A Promise resolved with a 'PropertyLoadResult' object containing the details of the result.
 */
export let loadTreeTableProperties = function() {
    arguments[ 0 ].updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs();
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};

/**
 * Loads the tasks to be rendered in the tree table.
 */
export let loadTreeTableData = function() {
    let treeLoadInput = arguments[ 0 ].treeLoadInput;
    let dataProvider = arguments[ 0 ].dataProvider;
    let declViewModel = arguments[ 0 ].declViewModel;
    let columnConfigInput = arguments[ 0 ].columnConfigInput;
    let columnProvider = arguments[ 0 ].columnProvider;
    let subPanelContext = arguments[ 0 ].subPanelContext;

    assert( subPanelContext, 'Missing subpanel context' );
    assert( treeLoadInput, 'Missing tree load input' );
    assert( declViewModel, 'Missing view model' );
    assert( dataProvider, 'Missing data provider' );

    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );
    if( failureReason ) {
        return AwPromiseService.instance.reject( failureReason );
    }

    //revisit this later. Remove data provider from ctx
    let smGanttCtx = appCtxSvc.getCtx( 'smGanttCtx' );
    if( !smGanttCtx ) {
        smGanttCtx = {};
    }
    smGanttCtx.treeDataProvider = dataProvider;
    appCtxSvc.registerCtx( 'smGanttCtx', smGanttCtx );

    return AwPromiseService.instance.resolve( _buildTreeTableStructure( treeLoadInput, dataProvider, declViewModel, columnConfigInput, columnProvider, subPanelContext ) );
};

/**
 * @param {TreeLoadInput} treeLoadInput - tree load input
 * @param {dataProvider} dataProvider - schedule navigation data provider
 * @param {declViewModel} declViewModel - the declrative view model
 * @param {ColumnConfigInput} columnConfigInput - column config for SOA
 * @param {columnProvider} columnProvider - column congfiguration provider
 * @param {subPanelContext} subPanelContext - subpanel context
 * @return {Promise} A Promise resolved with a 'TreeLoadResult' object containing the details of the result.
 */
function _buildTreeTableStructure( treeLoadInput, dataProvider, declViewModel, columnConfigInput, columnProvider, subPanelContext ) {
    treeLoadInput.isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    treeLoadInput.parentElementUid = treeLoadInput.parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    if( treeLoadInput.isTopNode ) {
        treeLoadInput.parentElementUid = subPanelContext.sourceSchedule.props.fnd0SummaryTask.dbValues[ 0 ];
        treeLoadInput.scheduleSummaryNode = schNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( cdm.getObject( treeLoadInput.parentElementUid ), undefined, 0, 0, declViewModel );
        if( subPanelContext.treeTableData ) {
            subPanelContext.treeTableData.update( { ...subPanelContext.treeTableData.getValue(), rootNode: treeLoadInput.scheduleSummaryNode } );
        }
    }

    let soaSearchInput = {
        attributesToInflate: [],
        maxToLoad: getDefaultPageSize( appCtxSvc.getCtx( 'preferences.AWC_DefaultPageSize' ) ),
        maxToReturn: getDefaultPageSize( appCtxSvc.getCtx( 'preferences.AWC_DefaultPageSize' ) ),
        providerName: 'Saw1TaskSearchProvider',
        searchCriteria: {
            ..._.cloneDeep( subPanelContext.provider.context.search.criteria ),
            sublocationToken: 'ScheduleGantt',
            searchContentType: 'ScheduleTask',
            searchContent: 'childTasks',
            includeProxies: 'true',
            topScheduleUid: subPanelContext.sourceSchedule.uid,
            parentTaskUid: treeLoadInput.parentElementUid
        },
        searchFilterFieldSortType: subPanelContext.searchState.sortType,
        searchFilterMap6: subPanelContext.searchState.activeFilterMap,
        searchSortCriteria: undefined,
        startIndex: treeLoadInput.startChildNdx,
        columnFilters: columnProvider.columnFilters
    };

    return getTableSummary( soaSearchInput, columnConfigInput, null ).then( function( response ) {
        let isEmptySchedule = treeLoadInput.isTopNode && ( _.isEmpty( response.searchResults ) || response.totalFound === 0 );
        let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
        if( scheduleNavigationCtx ) {
            scheduleNavigationCtx.isEmptySchedule = isEmptySchedule;
        }

        var vmNodes = [];
        if( !isEmptySchedule ) {
            if( response.searchResultsJSON ) {
                var searchResults = JSON.parse( response.searchResultsJSON );
                if( searchResults ) {
                    for( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[ x ].uid;
                        var obj = cdm.getObject( uid );
                        if( obj ) {
                            vmNodes.push( obj );
                        }
                    }
                }
            }
        } else {
            vmNodes.push( treeLoadInput.scheduleSummaryNode );
        }

        var treeLoadResult = exports.createTreeLoadResult( response, treeLoadInput, vmNodes, declViewModel );
        scheduleNavigationTreeRowService.cacheTreeNodes( treeLoadInput, vmNodes );

        if( treeLoadResult && treeLoadResult.childNodes && treeLoadResult.childNodes.length > 0 ) {
            processExpandBelow( treeLoadResult.childNodes, declViewModel );
        }

        if( treeLoadInput.isTopNode ) {
            // Expand the first level by default.
            if( treeLoadInput.scheduleSummaryNode.totalChildCount > 0 ) {
                appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.canShowGanttFilter', true );
            } else {
                appCtxSvc.updatePartialCtx( 'scheduleNavigationCtx.canShowGanttFilter', false );
            }

            treeLoadInput.scheduleSummaryNode.isLeaf = false;
            treeLoadInput.scheduleSummaryNode.isExpanded = true;

            let scheduleNode = schNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( cdm.getObject( treeLoadInput.parentNode.uid ), undefined, 0, -1, declViewModel );
            if( !isEmptySchedule ) {
                treeLoadResult.rootPathNodes = [ scheduleNode, treeLoadInput.scheduleSummaryNode ];
            } else {
                treeLoadResult.rootPathNodes = [ scheduleNode ];
            }

            // if( AwStateService.instance.params.c_uid ) {
            //     dataProvider.selectionModel.setSelection( [ AwStateService.instance.params.c_uid ] );
            // }
        }

        // Update the input parameters for loading dependencies.
        let loadScheduleInput = {
            parentTaskUid: treeLoadInput.parentElementUid,
            startTaskUid: vmNodes.length > 0 ? vmNodes[ 0 ].uid : '',
            endTaskUid: vmNodes.length > 0 ? vmNodes[ vmNodes.length - 1 ].uid : '',
            childNodes: vmNodes,
            loadCalendarInfo: subPanelContext.provider.scheduleNavigationContext.getValue().calendarInfo ? 'false' : 'true'
        };
        declViewModel.dispatch( { path: 'data.loadScheduleInput', value: loadScheduleInput } );

        // Process the output to update the filter information, only during first page load.
        // Ignore it during pagination as there should not be any change in filters.
        if( treeLoadInput.isTopNode ) {
            awSearchService.processOutput( response, declViewModel, subPanelContext.searchState );
        }

        return AwPromiseService.instance.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } );
}

/**
 * @param {SearchInput} searchInput - search input for SOA
 * @param {ColumnConfigInput} columnConfigInput - column config for SOA
 * @param {SaveColumnConfigData} saveColumnConfigData - save column config for SOA
 * @param {TreeLoadInput} treeLoadInput - tree load input
 * @return {Response} response A response object containing the details of the result.
 */
function getTableSummary( searchInput, columnConfigInput, saveColumnConfigData ) {
    return soaSvc.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', {
            columnConfigInput: columnConfigInput,
            saveColumnConfigData: saveColumnConfigData,
            searchInput: searchInput,
            inflateProperties: false,
            noServiceData: false
        }, policyIOverride )
        .then(
            function( response ) {
                if( response.searchResultsJSON ) {
                    response.searchResults = JSON.parse( response.searchResultsJSON );
                }

                // Create view model objects
                response.searchResults = response.searchResults &&
                    response.searchResults.objects ? response.searchResults.objects
                    .map( function( vmo ) {
                        return viewModelObjectService
                            .createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                    } ) : [];

                var propDescriptors = [];
                _.forEach( response.searchResults, function( vmo ) {
                    _.forOwn( vmo.propertyDescriptors, function( value ) {
                        propDescriptors.push( value );
                    } );
                } );

                // Remove duplicate ones from prop descriptors
                response.propDescriptors = _.uniq( propDescriptors, false,
                    function( propDesc ) {
                        return propDesc.name;
                    } );
                return response;
            } );
}

/**
 * Create tree load result
 *
 * @param {Object} response the response of performSearchViewModel SOA call
 * @param {Object} treeLoadInput the response of performSearchViewModel SOA call
 * @param {Object} vmNodes objects to process ViewModelTreeNode
 * @return {TreeLoadResult} treeLoadResult A treeLoadResult object containing the details of the result.
 */
export let createTreeLoadResult = function( response, treeLoadInput, vmNodes, declViewModel ) {
    var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
    var startReachedVar = true;

    if( treeLoadInput.scheduleSummaryNode ) {
        treeLoadInput.scheduleSummaryNode.totalChildCount = response.totalFound;
        treeLoadInput.scheduleSummaryNode.cursorObject = response.cursor;
    }

    treeLoadInput.parentNode.totalChildCount = response.totalFound;
    var treeLoadResult = processProviderResponse( treeLoadInput, vmNodes, startReachedVar, endReachedVar, declViewModel );

    treeLoadResult.parentNode.cursorObject = response.cursor;
    treeLoadResult.searchResults = response.searchResults;
    treeLoadResult.totalLoaded = response.totalLoaded;
    treeLoadResult.searchFilterCategories = response.searchFilterCategories;
    treeLoadResult.objectsGroupedByProperty = response.objectsGroupedByProperty;
    treeLoadResult.searchFilterMap6 = response.searchFilterMap6;

    // Revisit me: Move away from ctx to searchState. Is this check needed anymore?
    // Sync search context
    let searchContext = searchFilterService.buildSearchFilters( appCtxSvc.getCtx( 'search' ) );
    let contextChanged = !_.isEqual( appCtxSvc.getCtx( 'search' ), searchContext );
    if( contextChanged ) {
        appCtxSvc.registerCtx( 'search', searchContext );
    }

    return treeLoadResult;
};

/**
 * @param {TreeLoadInput} treeLoadInput - treeLoadInput Parameters for the operation.
 * @param {Object} searchResults - searchResults object processed from SOA call.
 * @param {Boolean} startReached - parameter for the operation.
 * @param {Boolean} endReached - parameter for the operation.
 * @return {TreeLoadResult} treeLoadResult A treeLoadResult object containing the details of the result.
 */
function processProviderResponse( treeLoadInput, searchResults, startReached, endReached, declViewModel ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.scheduleSummaryNode || treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    var vmNode;
    for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[ childNdx ];

        if( !awTableSvc.isViewModelTreeNode( object ) ) {
            vmNode = schNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( object, parentNode.uid, childNdx, levelNdx, declViewModel );
        } else {
            vmNode = object;
        }
        vmNodes.push( vmNode );
    }

    return awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
}

/**
 * Get the default page size used for max to load/return.
 *
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return searchCommonUtils.getDefaultPageSize( defaultPageSizePreference );
};

/**
 * Determines if the given uid represents an orphan Schedule Task.
 * @param {String} uid UID of the object
 * @returns {Boolean} Is the object an orphan Schedule Task ?
 */
let isOrphanTask = ( uid ) => {
    let object = cdm.getObject( uid );
    return cmm.isInstanceOf( 'ScheduleTask', object.modelType ) && object.props &&
        object.props.task_type && object.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.O;
};

/**
 * Parses the load schedule response to get the dependencies and calendar info.
 * @param {Object} response The load schedule reponse
 * @returns Object containing the dependencies and calendar info, if present.
 */
export let parseLoadScheduleResponse = ( response ) => {
    let loadScheduleResponse = { dependencyObjects: [] };

    // Parse dependencies
    if( response.taskDependenciesInfo ) {
        let dependencyObjects = [];
        let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
        response.taskDependenciesInfo.forEach( ( dependencyInfo ) => {
            let primaryUid = dependencyInfo.properties.primary_object;
            let secondaryUid = dependencyInfo.properties.secondary_object;

            // Process only dependencies whose primary or secondary is not an orphan task,
            // as the dependecies cannot be displayed without the primary/secondary in the tree.
            // Also, to render thse dependencies, Gantt will create mock task for these orphan tasks
            // which will never get resolved and thus leads to inconsistent structure w.r.t to tree table.
            // This check is needed until the server has the fix to avoid creating dependencies with
            // orphan tasks.
            if( !isOrphanTask( primaryUid ) && !isOrphanTask( secondaryUid ) ) {
                let dependencyObject = {};
                dependencyObject.uid = dependencyInfo.taskDependency.uid;
                dependencyObject.primaryUid = primaryUid;
                dependencyObject.secondaryUid = secondaryUid;
                dependencyObjects.push( dependencyObject );
                dependenciesInfo.push( dependencyObject );
            }
        } );
        loadScheduleResponse['loadedDependencies'] = dependencyObjects;
    }

    // Parse calendar info
    if( response.calendarInfo && response.calendarInfo.dayRanges ) {
        loadScheduleResponse['calendarInfo'] = {
            dayRanges: response.calendarInfo.dayRanges,
            eventRanges: response.calendarInfo.eventRanges  
        };
    }

    return loadScheduleResponse;
};

/**
 * Updates the schedule navigation context atomic data with the calendar info.
 * @param {Object} calendarInfo The calendar info
 * @param {Object} scheduleNavigationContext The atomic data to update
 */
export let updateContextWithCalendarInfo = ( calendarInfo, scheduleNavigationContext ) => {
    if( calendarInfo && calendarInfo.dayRanges ) {
        scheduleNavigationContext.update( {
            ...scheduleNavigationContext.getValue(),
            calendarInfo: { dayRanges: calendarInfo.dayRanges, eventRanges: calendarInfo.eventRanges }
        } );
    }
};

/**
 * Expand the selected parent task recursively
 * @param {Array} childNodes array of viemModelTreeNodes
 * @param {Array} declViewModel data
 */
let processExpandBelow = function( childNodes, declViewModel ) {
    let loadedVMObjects = declViewModel.dataProviders.scheduleNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
    if( _.isEmpty( loadedVMObjects ) ) {
        return;
    }

    _.forEach( childNodes, function( childNode ) {
        let parentNodeUid = childNode.parentNodeUid;
        let parentNode = _.find( loadedVMObjects, vmo => vmo.uid === parentNodeUid );
        if( parentNode ) {
            let isInExpandBelowMode = parentNode.isInExpandBelowMode;
            if( isInExpandBelowMode && !childNode.isLeaf ) {
                childNode.isInExpandBelowMode = true;
                awTableStateService.saveRowExpanded( declViewModel, 'scheduleNavigationTree', childNode );
            }
        }
    } );
};

/**
 * Table Cell Renderer handler for PL Table
 * @returns {DOMElement} cellContent - tree cell command Element
 */
let _treeCmdCellRender = function() {
    let eventSubs = [];
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            return schNavTreeCellRenderingService.createTreeCellCommandElement( column, vmo, tableElem );
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return column.isTreeNavigation === true;
        },
        name: 'scheduleNavigationTreeCommandCellRenderer',
        destroy: function() {
            _.forEach( eventSubs, function( eventBusSub ) {
                if( eventBusSub !== null ) {
                    eventBus.unsubscribe( eventBusSub );
                }
            } );
        }
    };
};

/**
 * Prepares and returns the loadOptions map for loadSchedule2 SOA
 * @returns {Object} The loadOptions map for loadSchedule2 SOA
 */
export let getLoadOptionsForLoadSchedule = function() {
    let schNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    let taskDepObjects = schNavigationCtx.dependenciesInfo;
    let taskDepStr = schNavTreeUtils.listToUidString( taskDepObjects );
    let rootTreeNode = schNavTreeUtils.getRootTreeNode();
    let loadedTreeNodes = schNavTreeUtils.getChildrenInHierarchy( rootTreeNode );
    let loadedTreenodeUids = schNavTreeUtils.getUidsOfTreeNodes( loadedTreeNodes );
    let thisPageNodes = schNavigationCtx.loadSchCtx.childNodes;
    let thisPageNodeUids = schNavTreeUtils.getUidsOfTreeNodes( thisPageNodes );
    let prevPageNodesUids = _.difference( loadedTreenodeUids, thisPageNodeUids );
    let loadedObjectsStr = schNavTreeUtils.listToUidString( prevPageNodesUids );
    return {
        isScheduleNavigationContext: 'true',
        parentTaskUid: schNavigationCtx.loadSchCtx.parentTaskUid,
        startTaskUid: schNavigationCtx.loadSchCtx.startTaskUid,
        endTaskUid: schNavigationCtx.loadSchCtx.endTaskUid,
        prevLoadedTasks: loadedObjectsStr,
        prevLoadedTaskDepenedencies: taskDepStr
    };
};

export default exports = {
    loadTreeTableColumns,
    onColumnFilterApplied,
    updateSchNavTreeTableColumns,
    updateColumnPropsAndNodeIconURLs,
    updateDisplayNames,
    loadTreeTablePropertiesOnInitialLoad,
    loadTreeTableProperties,
    loadTreeTableData,
    createTreeLoadResult,
    getDefaultPageSize,
    parseLoadScheduleResponse,
    updateContextWithCalendarInfo,
    getLoadOptionsForLoadSchedule
};
