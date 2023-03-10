//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/planNavigationTreeService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import awIconService from 'js/awIconService';
import iconSvc from 'js/iconService';
import eventBus from 'js/eventBus';
import searchCommonUtils from 'js/searchCommonUtils';
import awColumnService from 'js/awColumnService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import treeTableDataService from 'js/treeTableDataService';
import planNavService from 'js/PlanNavigationService';
import planNavTreeNodeCreateService from 'js/planNavigationTreeNodeCreateService';
import planNavTimelineSync from 'js/PlanNavigationTimelineSync';
import _ from 'lodash';
import uiTimelineUtils from 'js/Timeline/uiTimelineUtils';
import selectionSvc from 'js/selection.service';
import assert from 'assert';
import stackedEventsSvc from 'js/StackedEventsService';

let exports = {};
let _firstColumnPropertyName = null;
let planEventsMap = {};

var policyIOverride = {
    types: [ {
            name: 'WorkspaceObject',
            properties: [ {
                    name: 'object_name'
                },
                {
                    name: 'object_type'
                },
                {
                    name: 'object_string'
                }
            ]
        },
        {
            name: 'Awp0XRTObjectSetRow',
            properties: [ {
                name: 'awp0Target'
            } ]
        },
        {
            name: 'Prg0AbsPlan',
            properties: [ {
                    name: 'prg0ParentPlan'
                },
                {
                    name: 'prg0State'
                },
                {
                    name: 'pgp0NumberOfChildren'
                }
            ]
        }
    ]
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 */
export let loadTreeTableProperties = function() {
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Pgp0Timeline'
    };

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, propertyLoadContext );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 */
export let loadTreeTableColumns = function( uwDataProvider ) {
    var deferred = AwPromiseService.instance.defer();
    var awColumnInfos = [];
    awColumnInfos.push( awColumnService.createColumnInfo( {
        name: 'levels',
        displayName: 'Levels',
        typeName: 'String',
        width: 400,
        enableColumnResizing: true,
        enableColumnMoving: false,
        isTreeNavigation: true
    } ) );

    uwDataProvider.columnConfig = {
        columns: awColumnInfos
    };

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 * @param {object} contextPlan plan context data
 * @param {object} data data
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, isInitialLoad ) {
    let declViewModel = arguments[ 5 ].declViewModel;
    let subPanelContext = arguments[ 6 ];

    assert( declViewModel, 'Missing view model' );

    var deferred = AwPromiseService.instance.defer();
    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );
    if( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }
    // Get the 'child' nodes async
    return AwPromiseService.instance.resolve( _buildTreeTableStructure( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, isInitialLoad, declViewModel, subPanelContext ) );
};

/**
 * Function to update tree table columns
 *
 * @param {Object} data Contains data
 * @param {Object} dataProvider Contains data provider for the tree table
 */
export let updatePlanNavTreeTableColumns = function( data, dataProvider ) {
    if( dataProvider && data.newColumnConfig ) {
        var propColumns = data.newColumnConfig.columns;
        let clientColumns = !_.isEmpty( dataProvider.cols ) ? _.filter( dataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects() );
        data.newColumnConfig.columns = propColumns;
        dataProvider.columnConfig = data.newColumnConfig;
    }
};

/**
 * Function to update timelineContext on selection of plan object
 *
 * @param {Object} data Contains data
 */
export let updateTimelineContext = function( data ) {
    let selectedObject = appCtxSvc.ctx.mselected;
    let parentSelection = appCtxSvc.ctx.pselected;
    let selectedObjectIDInTree = data.eventMap[ 'planNavigationTreeDataProvider.selectionChangeEvent' ].selectedUids[ 0 ];
    if( appCtxSvc.ctx.planNavigationCtx && appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized && selectedObjectIDInTree ) {
        uiTimelineUtils.removeTaskSelection();
    }
    selectionSvc.updateSelection( selectedObject, parentSelection );
    let timelineContext = appCtxSvc.getCtx( 'timelineContext' );
    timelineContext.selected = selectedObject[ 0 ];
    appCtxSvc.updateCtx( 'timelineContext', timelineContext );
    // Publish event for setup the Program Board
    eventBus.publish( 'setupProgramBoard.selectionChanged', selectedObjectIDInTree );
    selectedObjectIDInTree = selectedObjectIDInTree ? selectedObjectIDInTree : appCtxSvc.ctx.selected.uid;
};

/**
 * To Sync Timeline View with change in Column Filtering
 * @param {Object} context
 */
export let setColumnFilterTimeline = function( eventData, planNavigationContext ) {
    // Process only the Plan Tree grid columns.
    if( eventData.gridId !== 'planNavigationTree' ) {
        return;
    }

    // First update the column filters and then update the plan navigation context.
    planNavigationContext.update( {
        ...planNavigationContext.getValue(),
        columnFilters: Array.isArray( eventData.filters ) ? eventData.filters : []
    } );
    planNavService.updatePlanNavigationContextOnFilterChange( planNavigationContext );
};
/**
 * Function to update tree table columns props and icon urls
 *
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
var updateColumnPropsAndNodeIconURLs = function( propColumns, childNodes ) {
    updateColumnPropsWithTypeName( propColumns );
    var firstColumnConfigColumn = _.filter( propColumns, function( col ) { return _.isUndefined( col.clientColumn ); } )[ 0 ];
    firstColumnConfigColumn.isTreeNavigation = true;
    firstColumnConfigColumn.enableColumnHiding = false;
    // Assumes first column value names the nodes.
    _firstColumnPropertyName = propColumns[ 0 ].propertyName;
    _.forEach( childNodes, function( childNode ) {
        childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
        treeTableDataService.updateVMODisplayName( childNode, _firstColumnPropertyName );
    } );
};

/**
 * Function to load properties
 *
 * @param {Object} propertyLoadInput input
 * @param {object} propertyLoadContext context
 * @returns {Object} propertyLoadResult property load result
 */
var _loadProperties = function( propertyLoadInput, propertyLoadContext ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );
    var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );
    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                    var propColumns = response.output.columnConfig.columns;
                    updateColumnPropsWithTypeName( propColumns );
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
                if( response.output.columnConfig && !_.isEmpty( response.output.columnConfig.columns ) ) {
                    _firstColumnPropertyName = response.output.columnConfig.columns[ 0 ].propertyName;
                }
            }

            //update viewModelProperties
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
};

/**
 * Function to update column properties with type Name
 *
 * @param {Array} propColumns column list
 */
var updateColumnPropsWithTypeName = function( propColumns ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
    } );
};

/**
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {object} contextPlan plan context information
 * @param {object} data data
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 *
 */
var _buildTreeTableStructure = function( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, isInitialLoad, declViewModel, subPanelContext ) {
    treeLoadInput.parentElement = treeLoadInput.parentNode.uid;
    treeLoadInput.displayMode = 'Tree';

    treeLoadInput.isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    if( treeLoadInput.isTopNode ) {
        declViewModel.dataProviders.planNavigationTreeDataProvider.viewModelCollection.clear();
    }
    if( subPanelContext.treeTableData ) {
        subPanelContext.treeTableData.update( { ...subPanelContext.treeTableData.getValue(), rootNode: treeLoadInput.rootNode } );
    }

    let soaSearchInput = searchInput;
    soaSearchInput.searchCriteria = {};
    soaSearchInput.searchCriteria.parentUid = treeLoadInput.parentElement;
    soaSearchInput.searchCriteria.searchContentType = 'childPlanObjects';
    soaSearchInput.searchCriteria.returnParentHierarchy = isInitialLoad;
    return getTableSummary( soaSearchInput, columnConfigInput, saveColumnConfigData ).then( function( response ) {
        var vmNodes = [];
        if( response.searchResultsJSON ) {
            var searchResults = JSON.parse( response.searchResultsJSON );
            if( searchResults ) {
                for( var x = 0; x < searchResults.objects.length; ++x ) {
                    var searchObjUid = searchResults.objects[ x ].uid;
                    let searchObj = cdm.getObject( searchObjUid );
                    if( searchObj ) {
                        vmNodes.push( searchObj );
                    }
                }
            }
        }

        var treeLoadResult = exports.createTreeLoadResult( response, treeLoadInput, vmNodes, isInitialLoad, declViewModel );

        return AwPromiseService.instance.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } );
};

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
                        return viewModelObjectSvc
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
export let createTreeLoadResult = function( response, treeLoadInput, vmNodes, isInitialLoad, declViewModel ) {
    var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;
    var startReachedVar = true;

    treeLoadInput.parentNode.totalFound = response.totalFound;
    var treeLoadResult = processProviderResponse( treeLoadInput, vmNodes, startReachedVar, endReachedVar, null, isInitialLoad, declViewModel );

    treeLoadResult.parentNode.cursorObject = response.cursor;
    treeLoadResult.searchResults = response.searchResults;
    treeLoadResult.totalLoaded = response.totalLoaded;
    treeLoadResult.searchFilterCategories = response.searchFilterCategories;
    treeLoadResult.objectsGroupedByProperty = response.objectsGroupedByProperty;
    treeLoadResult.searchFilterMap6 = response.searchFilterMap6;

    return treeLoadResult;
};

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} searchResults - SOA Response
 * @param {startReached} startReached - start Reached
 * @param {endReached} endReached - end Reached
 * @param {data} data - the data
 * @param {Boolean} isInitialLoad - is initialization of tree
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
var processProviderResponse = function( treeLoadInput, searchResults, startReached, endReached, data, isInitialLoad, declViewModel ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;
    parentNode.isExpanded = true;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];

    let columnFilteringApplied = false;
    let columnFilters = [];
    if( declViewModel && declViewModel.columnProviders.planNavigationTreeColumnProvider ) {
        columnFilters = declViewModel.columnProviders.planNavigationTreeColumnProvider.columnFilters;
        if( columnFilters && columnFilters.length > 0 ) {
            columnFilteringApplied = true;
        }
    }

    if( columnFilteringApplied ) {
        declViewModel.dataProviders.planNavigationTreeDataProvider.viewModelCollection.clear();

        if( searchResults.length > 0 ) {
            var object = searchResults[ 0 ];
            if( parentNode.levelNdx === -1 ) {
                let modelObject = cdm.getObject( object.uid );
                let displayName = _.get( modelObject, 'props.object_string.uiValues[0]', '' );
                let vmNode = planNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( modelObject, displayName, parentNode.uid, childNdx, levelNdx, declViewModel );
                if( vmNode ) {
                    vmNode.isExpanded = true;
                    vmNodes.push( vmNode );
                    parentNode = vmNode;
                }
            }
        }
        for( var childNdx = 1; childNdx < searchResults.length; childNdx++ ) {
            var object = searchResults[ childNdx ];
            let modelObject = cdm.getObject( object.uid );
            let displayName = _.get( modelObject, 'props.object_string.uiValues[0]', '' );
            levelNdx = parentNode.levelNdx + 1;
            let vmNode = planNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( modelObject, displayName, parentNode.uid, childNdx, levelNdx, declViewModel );
            vmNode.events = planEventsMap[ modelObject.uid ];
            if( vmNode ) {
                vmNodes.push( vmNode );
                if( !parentNode.children ) {
                    parentNode.children = [];
                }
                parentNode.children.push( vmNode );
            }
        }
        parentNode.isLeaf = searchResults.length <= 1;
    } else {
        // treeNodes contains values of folders we want to expand as a
        // result of the Node Checkout and Add to child branch operation.
        // Information is in the SOA service data
        var treeNodes = appCtxSvc.getCtx( 'checkedOutCreatedNodes' );
        let existingParentUid = undefined;
        let parentIndex = -1;
        if( isInitialLoad === 'true' ) {
            parentIndex = _.findIndex( searchResults, ( result ) => {
                return result.uid === parentNode.uid;
            } );
        }
        for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
            var object = searchResults[ childNdx ];
            let parentUid = object.props.prg0ParentPlan.dbValues[ 0 ];
            if( existingParentUid !== parentNode.uid && vmNodes.length > 0 ) {
                existingParentUid = parentNode.uid;
                let index = _.findIndex( vmNodes, function( node ) { return node.uid === parentUid; } );
                if( index >= 0 ) {
                    parentNode = vmNodes[ index ];
                    levelNdx = parentNode.levelNdx + 1;
                }
                if( !parentUid ) {
                    parentNode = null;
                }
            }
            let modelObject = cdm.getObject( object.uid );
            let displayName = _.get( modelObject, 'props.object_string.uiValues[0]', '' );
            let vmNode = planNavTreeNodeCreateService.createViewModelTreeNodeUsingModelObject( modelObject, displayName, parentNode.uid, childNdx, levelNdx, declViewModel );
            vmNode.events = planEventsMap[ modelObject.uid ];
            //Expand all the parent plan of the opened object
            if( childNdx <= parentIndex ) {
                vmNode.isExpanded = true;
            }
            if( isInitialLoad === 'true' ) {
                if( !parentUid ) {
                    delete vmNode.parentNodeUid;
                } else {
                    let index = _.findIndex( vmNodes, function( node ) { return node.uid === parentUid; } );
                    if( index >= 0 ) {
                        parentNode = vmNodes[ index ];
                        if( !parentNode.children ) {
                            parentNode.children = [];
                        }
                        vmNode.childNdx = parentNode.children.length;
                        parentNode.children.push( vmNode );
                    }
                }
            }
            checkForPlanObjectsToExpand( treeNodes, vmNode );
            if( vmNode ) {
                vmNodes.push( vmNode );
            }
        }
        parentNode.isLeaf = searchResults.length === 0;
    }
    // Third Paramter is for a simple vs ??? tree
    return awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached, endReached, null );
};

/**
 * This function will check the check out node SOA response values to
 * determine if there are any new plan objects to expand in the tree
 * @param {Array} treeNodes treeNodes list
 * @param {object} vmNode vmNode
 */
var checkForPlanObjectsToExpand = function( treeNodes, vmNode ) {
    if( treeNodes ) {
        for( var x = 0; x < treeNodes.length; x++ ) {
            // check if a folder is in the service data returned from the CO SOA response
            if( treeNodes[ x ] === vmNode.uid ) {
                // Store node we want to expand, and store in array
                // that we will process after tree loads
                // Once we save the tree node, clean up the ctx value so that
                // the processed value does not get processed again and keeps
                // the ctx value correct
                treeNodes.splice( x, 1 );
                // Once all the nodes are processed, delete ctx value
                if( treeNodes.length === 0 ) {
                    appCtxSvc.unRegisterCtx( 'checkedOutCreatedNodes' );
                } else {
                    appCtxSvc.registerCtx( 'checkedOutCreatedNodes', treeNodes );
                }
            }
        }
    }
};

/**
 * function to evaluate the icon URL
 * @param {objType} objType object type
 * @return {iconURL} iconURL
 */
var evaluateIconUrlForNode = function( objType ) {
    var iconURL = null;
    if( objType ) {
        iconURL = iconSvc.getTypeIconURL( objType );
    }
    return iconURL;
};

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
 * Create input of Plan Uids to render Events in Timeline
 * @param {data} data
 * @returns {string} planUids
 */
export let getListOfPlanObj = function( treeLoadResult, planNavigationContext ) {
    let planUidString = '';
    if( planNavigationContext && !_.isEmpty( planNavigationContext.columnFilters ) ) {
        for( let idx = 0; idx < treeLoadResult.length; idx++ ) {
            planUidString += treeLoadResult[ idx ].uid + ',';
        }
        planUidString = planUidString.substring( 0, planUidString.length - 1 );
    }
    return planUidString;
};

/**
 * render events returned by SOA into Timeline
 * @param {*} soaResponse
 * @param {*} data
 */
export let processEvents = function( soaResponse, data, subPanelContext ) {
    let searchResults = JSON.parse( soaResponse.searchResultsJSON );
    let planEventMap = {};
    let eventObjs = [];
    var mapPlanEventInfo = new Map();
    var mapOfAdjEventAndOffset = new Map();
    for( let index = 0; index < searchResults.objects.length; index++ ) {
        var eventUid = searchResults.objects[ index ].uid;
        let eventObj = cdm.getObject( eventUid );
        if( eventObj && eventObj.props.prg0PlanObject ) {
            let planUid = eventObj.props.prg0PlanObject.dbValues[ 0 ];
            let events = planEventMap[ planUid ];
            if( !events ) {
                events = [];
            }
            events.push( eventObj );
            eventObjs.push( eventObj );
            planEventMap[ planUid ] = events;
        }
    }
    let loadedPlanObjects = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
    for( let planUid in planEventMap ) {
        let index = _.findIndex( loadedPlanObjects, ( loadedPlan ) => {
            return planUid === loadedPlan.uid;
        } );
        if( index >= 0 ) {
            let planObject = loadedPlanObjects[ index ];
            planObject.events = planEventMap[ planUid ];
        }
    }
    if( !appCtxSvc.getCtx( 'popupContext' ) ) {
        stackedEventsSvc.registerContextForStackedEvents();
    }

    for( let planUid in planEventMap ) {
        var events;
        events = planEventMap[ planUid ];
        if( events ) {
            mapOfAdjEventAndOffset = uiTimelineUtils.findAdjEventAndOffset( events );
            mapPlanEventInfo.set( planUid, mapOfAdjEventAndOffset );
        }
    }
    //To handle the case when subprojects are there in the program for stacked event
    if( appCtxSvc.ctx.popupContext.mapParentPlanEvent.size > 0 ) {
        for( const [ planUid, mapOfEventOffsets ] of mapPlanEventInfo.entries() ) {
            let finalMap = appCtxSvc.ctx.popupContext.mapParentPlanEvent;
            if( !finalMap.get( planUid ) ) {
                finalMap.set( planUid, mapOfEventOffsets );
                appCtxSvc.ctx.popupContext.mapParentPlanEvent = finalMap;
            }
        }
    } else if( appCtxSvc.ctx.popupContext.mapParentPlanEvent.size <= 0 ) {
        appCtxSvc.ctx.popupContext.mapParentPlanEvent = mapPlanEventInfo;
    }
    uiTimelineUtils.findCountWithZoomeLevel( 'Event' );

    if( subPanelContext.timelineData ) {
        subPanelContext.timelineData.update( { ...subPanelContext.timelineData.getValue(), eventObjects: eventObjs } );
    }
    let isTimelineEnabled = appCtxSvc.getCtx( 'preferences.AW_SubLocation_PlanNavigationSubLocation_ShowTimeline' );
    if( isTimelineEnabled && isTimelineEnabled[ 0 ].toLowerCase() === 'true' && appCtxSvc.ctx.planNavigationCtx.isTimelineInitialized ) {
        // planNavTimelineSync.addEventObjectsInTimeline( eventObjs, data ); //remove this for new timeline component
        //Event to be published only when the Show Dependency toggle is ON
        if( appCtxSvc.ctx.showHideEventDependencyFlag && eventObjs.length > 0 ) {
            eventBus.publish( 'fetchEventDependencies', eventObjs );
        }
    }
};

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 *
 * @param {Object} data ViewModel
 */
export let updatePlanDisplayNames = function( data ) {
    let eventData = data.eventMap[ 'vmc.modified.planNavigationTreeDataProvider' ];

    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        var loadedVMObjects = eventData.vmc.loadedVMObjects;
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            var modifiedVMOs = loadedVMObjects.filter( function( vmo ) { return vmo.id === modifiedObject.uid; } );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                treeTableDataService.updateVMODisplayName( modifiedVMO, _firstColumnPropertyName );
            } );
        } );
    }
};

/**
 * Update the ctx with data required for command condition evaluation.
 */
export let updateCtxWithCommandConditionData = ( dataProvider ) => {
    let planNavigationCtx = appCtxSvc.getCtx( 'planNavigationCtx' );
    if( !planNavigationCtx ) {
        planNavigationCtx = {};
    }

    if( dataProvider ) {
        let vmNodes = dataProvider.getSelectedObjects();

        // Update the parent of selected node in the ctx.
        if( vmNodes && vmNodes.length === 1 && !_.isEmpty( vmNodes[ 0 ].parentNodeUid ) ) {
            let vmCollection = dataProvider.viewModelCollection;
            let parentNode = _.find( vmCollection.loadedVMObjects, vmo => vmo.uid === vmNodes[ 0 ].parentNodeUid );
            if( !planNavigationCtx.parentOfSelectedNode || planNavigationCtx.parentOfSelectedNode.uid !== parentNode.uid ) {
                planNavigationCtx.parentOfSelectedNode = parentNode;
            }
        } else {
            planNavigationCtx.parentOfSelectedNode = undefined;
        }
        appCtxSvc.updateCtx( 'planNavigationCtx', planNavigationCtx );
    }
};

/**
 * planNavigationTreeService factory
 */
export default exports = {
    loadTreeTableProperties,
    setColumnFilterTimeline,
    loadTreeTableColumns,
    loadTreeTableData,
    updatePlanNavTreeTableColumns,
    updateTimelineContext,
    getDefaultPageSize,
    createTreeLoadResult,
    getListOfPlanObj,
    processEvents,
    updatePlanDisplayNames,
    updateCtxWithCommandConditionData
};
