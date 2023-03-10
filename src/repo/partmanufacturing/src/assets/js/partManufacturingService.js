// Copyright (c) 2022 Siemens

/**
 * @module js/partManufacturingService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import awColumnSvc from 'js/awColumnService';
import awIconSvc from 'js/awIconService';
import dataManagementSvc from 'soa/dataManagementService';
import localeService from 'js/localeService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import prefSvc from 'soa/preferenceService';
import tcVmoService from 'js/tcViewModelObjectService';
import occTypeSvc from 'js/occurrenceTypesService';
import { updateURL } from 'js/awSearchSublocationService';
import msgSvc from 'js/messagingService';
import _ from 'lodash';

var exports = {};

var _proxyObjects = null;
var _resourcesColConfigData;
var _promiseColumnConfig = null;

export let registerContext = function( subPanelContext ) {
    registerPartMfgContext( subPanelContext );
};

export let unregisterContext = function() {
    appCtxSvc.unRegisterCtx( 'PartMfg' );
};

/**
 * Checks if selected object is 'MENCMachining Revision' <br>
 *
 * @return true if pre-conditions are satisfied
 */
function checkPreconditionsForToolActivityUserData( subPanelContext ) {
    var selectedMO = subPanelContext.openedObject;

    return selectedMO.modelType.typeHierarchyArray.indexOf( 'MENCMachining Revision' ) > -1;
}

function getTypesForAddResource() {
    var resLength = appCtxSvc.ctx.preferences.AWC_PartMfg_AddResource_Types ? appCtxSvc.ctx.preferences.AWC_PartMfg_AddResource_Types.length : 0;
    var resTypesStr = '';
    if( resLength > 0 ) {
        for( var idx = 0; idx < resLength; idx++ ) {
            resTypesStr += appCtxSvc.ctx.preferences.AWC_PartMfg_AddResource_Types[ idx ];
            if( idx < resLength - 1 ) {
                resTypesStr += ',';
            }
        }
    } else {
        // Use resource type Mfg0MEResource if pref is not AWC_PartMfg_AddResource_Types found
        resTypesStr = 'Mfg0MEResource';
    }
    return resTypesStr;
}

/**
 *
 * @param propertyLoadRequests
 * @returns Promise
 */
function _loadProperties( propertyLoadInput, subPanelContext ) {
    var allChildNodes = [];
    var columnPropNames = [];
    var allChildUids = [];

    columnPropNames.push( 'awp0ThumbnailImageTicket' );

    /**
     * Note: Assume each propertyLoadRequest has the same columns
     */
    if( !_.isEmpty( propertyLoadInput.propertyLoadRequests ) ) {
        _.forEach( propertyLoadInput.propertyLoadRequests[ 0 ].columnInfos, function( columnInfo ) {
            columnPropNames.push( columnInfo.name );
        } );
    }

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            if( cdm.isValidObjectUid( childNode.uid ) && childNode.uid !== 'top' ) {
                allChildNodes.push( childNode );
                allChildUids.push( childNode.uid );
            }
        } );
    } );

    var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

    var selectedMO = subPanelContext.provider.baseSelection;

    if( selectedMO && cdm.isValidObjectUid( selectedMO.uid ) ) {
        allChildUids.push( selectedMO.uid );
    }

    if( _.isEmpty( allChildUids ) ) {
        return AwPromiseService.instance.resolve( {
            propertyLoadResult: propertyLoadResult
        } );
    }

    columnPropNames = _.uniq( columnPropNames );
    allChildUids = _.uniq( allChildUids );

    return dataManagementSvc.loadObjects( allChildUids ).then(
        function() { // eslint-disable-line no-unused-vars
            var vmoObjs = [];
            /**
             * Create a ViewModelObject for each of the returned 'child' nodes
             */
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.uid ), 'EDIT' );

                vmoObjs.push( vmo );
            } );
            return tcVmoService.getViewModelProperties( vmoObjs, columnPropNames ).then(
                function() {
                    /**
                     * Create a ViewModelObject for each of the returned 'child' nodes
                     */
                    _.forEach( vmoObjs, function( vmo ) {
                        if( vmo.props ) {
                            _.forEach( allChildNodes, function( childNode ) {
                                if( childNode.uid === vmo.uid ) {
                                    if( !childNode.props ) {
                                        childNode.props = {};
                                    }
                                    _.forEach( vmo.props, function( vmProp ) {
                                        childNode.props[ vmProp.propertyName ] = vmProp;
                                    } );
                                }
                            } );
                        }
                    } );

                    return {
                        propertyLoadResult: propertyLoadResult
                    };
                } );
        } );
}

/**
 *
 */
function registerPartMfgContext( subPanelContext ) {
    var activeTabIndex = 0;

    var parentElementUid = null;
    var parentElement = null;
    var productContext = null;
    var activityLine = null;
    var addElement = null;
    // Default activities Client Scope URI
    var activitiesClientScopeURI = 'Pm1Activities';
    var supportedFeatures = null;
    var resourceTypesForAdd = getTypesForAddResource();
    var itemTypeOccTypesMap = {};
    var itemTypeDefOccTypeMap = {};

    var partMfgCtx = {
        activeTabIndex: activeTabIndex,
        parentElementUid: parentElementUid,
        parentElement: parentElement,
        productContext: productContext,
        activityLine: activityLine,
        activitiesClientScopeURI: activitiesClientScopeURI,
        addElement: addElement,
        supportedFeatures: supportedFeatures,
        resourceTypesForAdd: resourceTypesForAdd,
        itemTypeOccTypesMap: itemTypeOccTypesMap,
        itemTypeDefOccTypeMap: itemTypeDefOccTypeMap
    };

    appCtxSvc.registerCtx( 'PartMfg', partMfgCtx );

    //override the default activities clientScopeURI if the preconditions are satisfied
    //and the preference MPP_ToolActivity_EnableUserData is enabled
    var selectedMO = subPanelContext.openedObject;

    var bUserDataAttr = selectedMO.modelType.typeHierarchyArray.indexOf( 'MENCMachining Revision' ) > -1;
    if( bUserDataAttr ) {
        //Get the preference value for MPP_ToolActivity_EnableUserData
        prefSvc.getLogicalValue( 'MPP_ToolActivity_EnableUserData' ).then(
            function( result ) {
                if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                    appCtxSvc.updatePartialCtx( 'PartMfg.activitiesClientScopeURI', 'Pm1NCActivities' );
                }
            } );
    }
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 *
 */
export let loadTreeTableProperties = function( subPanelContext ) { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, subPanelContext );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 * @param {occurrenceInfo} occ - Occurrence Information sent by server
 * @param {childNdx} child Index
 * @param {levelNdx} Level index
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var hasChildren = containChildren( obj );

    var iconURL = null;

    if( obj.props ) {
        if( obj.props.object_string ) {
            displayName = obj.props.object_string.uiValues[ 0 ];
        }
    }

    if( !iconURL && obj ) {
        if( obj.modelType.typeHierarchyArray.indexOf( 'CfgAttachmentLine' ) > -1 ) {
            var alObj = cdm.getObject( obj.props.al_object.dbValues[ 0 ] );
            iconURL = awIconSvc.getTypeIconFileUrl( alObj );
        } else {
            iconURL = awIconSvc.getTypeIconFileUrl( obj );
        }
    }

    var vmNode = awTableSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = !hasChildren;

    return vmNode;
}

function containChildren( obj ) {
    if( obj.modelType.typeHierarchyArray.indexOf( 'MECfgLine' ) > -1 ) {
        if( obj.props && obj.props.me_cl_has_children && obj.props.me_cl_has_children.dbValues[ 0 ] === '1' ) {
            return true;
        }
        return false;
    }
    return false;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
function processProviderResponse( treeLoadInput, searchResults ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];

    for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[ childNdx ];
        if( object.modelType.typeHierarchyArray.indexOf( 'CfgActivityLine' ) < 0 ) {
            object = cdm.getObject( object.props.al_object.dbValues[ 0 ] );
        }
        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx );
        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }

    // Third Paramter is for a simple vs ??? tree
    return awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, null );
}

/**
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ColumnConfigInput} columnConfigInput - Column Configuration Input
 * @param {inflateProp} inflateProp - If true, the properties will be inflated (the properties will be loaded and fully populated).
 *
 */
function _buildActivityStructure( parentNode, deferred, treeLoadInput, columnConfigInput, inflateProp, subPanelContext ) {
    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );
    var selectedMO = subPanelContext.provider.baseSelection;

    var targetNode = parentNode.isExpanded ? parentNode.uid : undefined;

    var policyID = policySvc.register( {
        types: [ {
            name: 'CfgAttachmentLine',
            properties: [ {
                name: 'me_cl_display_string'
            },
            {
                name: 'me_cl_object_name'
            },
            {
                name: 'me_cl_object_desc'
            },
            {
                name: 'me_cl_object_type'
            },
            {
                name: 'me_cl_owning_group'
            },
            {
                name: 'me_cl_owning_user'
            },
            {
                name: 'me_cl_last_mod_date'
            },
            {
                name: 'me_cl_has_children'
            },
            {
                name: 'me_cl_child_count'
            },
            {
                name: 'al_object',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'me_cl_child_lines',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]

            }
            ]
        },
        {
            name: 'CfgActivityLine',
            properties: [ {
                name: 'al_activity_long_description'
            },
            {
                name: 'al_activity_start_time'
            },
            {
                name: 'al_activity_time'
            },
            {
                name: 'al_activity_calc_start_time'
            },
            {
                name: 'al_activity_calc_time'
            },
            {
                name: 'al_activity_nc_tool_number'
            },
            {
                name: 'al_activity_tool_bl_list',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0al_activity_SpindleId'
            }
            ]
        },
        {
            name: 'MEActivity',
            properties: [ {
                name: 'object_name'
            },
            {
                name: 'object_desc'
            },
            {
                name: 'object_type'
            },
            {
                name: 'owning_user'
            },
            {
                name: 'owning_group'
            },
            {
                name: 'last_mod_user'
            },
            {
                name: 'contents',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
        }
        ]
    } );

    var soaInput = {
        inflateProperties: inflateProp,
        columnConfigInput: columnConfigInput,
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Pm1ActivityListProvider',
            searchCriteria: {
                parentUid: selectedMO.uid,
                activityLineUid: targetNode
            },
            cursor: {
                startIndex: treeLoadInput.startChildNdx
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {}
        }
    };

    treeLoadInput.parentElement = targetNode && targetNode.levelNdx > -1 ? targetNode.id : 'AAAAAAAAAAAAAA';
    treeLoadInput.displayMode = 'Tree';

    return soaSvc.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', soaInput ).then(
        function( response ) {
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }
            _proxyObjects = [];

            if( response && response.searchResults && response.searchResults.objects ) {
                _.forEach( response.searchResults.objects, function( obj ) {
                    _proxyObjects.push( cdm.getObject( obj.uid ) );
                } );
            }

            if( !parentNode.isExpanded && !partMfgCtx.activityLine && response.ServiceData && response.ServiceData.plain ) {
                var plen = response.ServiceData.plain.length;
                if( plen > 0 ) {
                    var uid = response.ServiceData.plain[ plen - 1 ];
                    appCtxSvc.updatePartialCtx( 'PartMfg.activityLine', uid );
                    var newparentNode = createVMNodeUsingObjectInfo( cdm.getObject( uid ), 0, -1 );
                    treeLoadInput.parentNode = newparentNode;
                    treeLoadInput.startChildNdx = 0;
                }
            } else {
                targetNode = parentNode.uid;
                treeLoadInput.startChildNdx = 0;
            }

            var treeLoadResult = processProviderResponse( treeLoadInput, _proxyObjects );
            if( response.columnConfig.columns[ 0 ] ) {
                response.columnConfig.columns[ 0 ].isTreeNavigation = true;
            }

            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                columnConfig: response.columnConfig
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * @param {ColumnConfigInput} columnConfigInput - Column Configuration Input
 * @param {inflateProp} inflateProp - If true, the properties will be inflated (the properties will be loaded and fully populated).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadActivitiesData = function( treeLoadInput, columnConfigInput, inflateProp, subPanelContext ) {
    /**
     * Check the validity of the parameters
     */
    var deferred = AwPromiseService.instance.defer();

    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }

    _buildActivityStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnConfigInput, inflateProp, subPanelContext );
    return deferred.promise;
};

export let loadAttachmentsData = function( dataProvider, columnConfigInput, saveColumnConfigData, inflateProp, subPanelContext ) {
    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    var selectedMO = subPanelContext.provider.baseSelection;

    var objectSet = '';
    objectSet += 'IMAN_specification.Dataset';
    objectSet += ',IMAN_reference.Dataset';
    objectSet += ',IMAN_manifestation.Dataset';
    objectSet += ',IMAN_Rendering.Dataset';
    objectSet += ',TC_Attaches.Dataset';
    objectSet += ',IMAN_UG_altrep.Dataset';
    objectSet += ',IMAN_UG_scenario.Dataset';
    objectSet += ',IMAN_Simulation.Dataset';

    var filterMap = subPanelContext.provider.attachmentsState.activeFilterMap ? subPanelContext.provider.attachmentsState.activeFilterMap : undefined;
    var filterMapSize = filterMap && filterMap.hasOwnProperty( 'Dataset.object_type' ) ? filterMap[ 'Dataset.object_type' ].length : 0;

    if( filterMap && filterMapSize > 0 ) {
        var inputData = {
            columnConfigInput: columnConfigInput,
            searchInput: {
                maxToLoad: 50,
                maxToReturn: 50,
                providerName: 'Pm1AttachmentListProvider',
                searchCriteria: {
                    objectSet: objectSet,
                    parentUid: selectedMO.uid,
                    returnTargetObjs: 'true'
                },
                cursor: {
                    startIndex: dataProvider.startIndex
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: filterMap
            },
            saveColumnConfigData: saveColumnConfigData,
            inflateProperties: inflateProp
        };
    } else {
        var inputData = {
            columnConfigInput: columnConfigInput,
            searchInput: {
                maxToLoad: 50,
                maxToReturn: 50,
                providerName: 'Pm1AttachmentListProvider',
                searchCriteria: {
                    objectSet: objectSet,
                    parentUid: selectedMO.uid,
                    returnTargetObjs: 'true'
                },
                cursor: {
                    startIndex: dataProvider.startIndex
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: {}
            },
            saveColumnConfigData: saveColumnConfigData,
            inflateProperties: inflateProp
        };
    }

    return soaSvc.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', inputData ).then(
        function( response ) {
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }

            // Collect all the prop Descriptors
            var propDescriptors = [];
            _.forEach( response.searchResults, function( vmo ) {
                _.forOwn( vmo.propertyDescriptors, function( value ) {
                    propDescriptors.push( value );
                } );
            } );

            // Weed out the duplicate ones from prop descriptors
            response.propDescriptors = _.uniq( propDescriptors, false,
                function( propDesc ) {
                    return propDesc.name;
                } );

            var categoryValues = response.searchFilterMap6;

            var typeFilters = categoryValues && categoryValues.hasOwnProperty( 'Dataset.object_type' ) ? categoryValues[ 'Dataset.object_type' ] : undefined;
            if( typeFilters ) {
                var typeNames = [];
                _.forEach( typeFilters, function( typeFilter ) {
                    typeNames.push( typeFilter.stringValue );
                } );

                var promise = soaSvc.ensureModelTypesLoaded( typeNames );
                if( promise ) {
                    promise.then( function() {
                        _.forEach( typeFilters, function( typeFilter ) {
                            if( cmm.containsType( typeFilter.stringValue ) ) {
                                var type = cmm.getType( typeFilter.stringValue );
                                typeFilter.stringDisplayValue = type.displayName;
                            } else {
                                typeFilter.stringDisplayValue = typeFilter.stringValue;
                            }
                        } );
                    } );
                }
            }

            var activeTypes = [];
            var afMap = filterMap;

            if( afMap && afMap.hasOwnProperty( 'Dataset.object_type' ) ) {
                var activeFilters = afMap[ 'Dataset.object_type' ];
                _.forEach( activeFilters, function( activeFilter ) {
                    activeTypes.push( activeFilter.stringValue );
                } );

                var filteredResults = [];

                if( response.searchResults && response.searchResults.objects ) {
                    _.forEach( response.searchResults.objects, function( obj ) {
                        if( activeTypes.includes( obj.type ) ) {
                            filteredResults.push( viewModelObjectSvc
                                .createViewModelObject( obj.uid, 'EDIT', null, obj ) );
                        }
                    } );

                    response.searchResults = filteredResults;
                    response.totalFound = filteredResults.length;
                    response.totalLoaded = filteredResults.length;
                }
            } else // No filter
            {
                // Create view model objects
                response.searchResults = response.searchResults &&
                    response.searchResults.objects ? response.searchResults.objects
                        .map( function( vmo ) {
                            return viewModelObjectSvc
                                .createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];
            }
            if( !response.searchFilterMap6 ) {
                response.searchFilterMap6 = {
                    'Dataset.object_type': []
                };
            }

            if( response.columnConfig.columns[ 0 ] ) {
                response.columnConfig.columns[ 0 ].isTableCommand = true;
            }
            return response;
        } );
};

/**
 * Handle tab selection change
 *
 * @param {Object} viewModel
 */
export let handleTabSelectionChange = function( viewModel ) {
    if( viewModel && viewModel.tabDocAndRes && viewModel.tabDocAndRes[ 0 ].selectedTab ) {
        appCtxSvc.updatePartialCtx( 'PartMfg.activeTabIndex', 0 );
    } else if( viewModel && viewModel.tabDocAndRes && viewModel.tabDocAndRes[ 1 ].selectedTab ) {
        appCtxSvc.updatePartialCtx( 'PartMfg.activeTabIndex', 1 );
    }
};

export let loadResourcesData = function( declViewModel, dataProvider, columnConfigInput, saveColumnConfigData, inflateProp, subPanelContext ) {
    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    var policyID = policySvc.register( {
        types: [ {
            name: 'Awb0Element',
            properties: [ {
                name: 'awb0OccType'
            },
            {
                name: 'awb0UnderlyingObjectType'
            }
            ]
        },
        {
            name: 'Awb0ProductContextInfo',
            properties: [ {
                name: 'awb0SupportedFeatures',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: 'Awb0FeatureList',
            properties: [ {
                name: 'awb0AvailableFeatures'
            },
            {
                name: 'awb0NonModifiableFeatures'
            }
            ]
        }
        ]
    } );

    var deferred = AwPromiseService.instance.defer();
    var selectedMO = subPanelContext.provider.baseSelection;
    var occTypesArr = [];

    var filterMap = subPanelContext.searchState.activeFilterMap ? subPanelContext.searchState.activeFilterMap : undefined;
    var filterMapSize = filterMap && filterMap.hasOwnProperty( 'BOMLine.bl_occ_type' ) ? filterMap[ 'BOMLine.bl_occ_type' ].length : 0;

    var searchCriteria = {
        parentUid: selectedMO.uid,
        parentElementUid: partMfgCtx.parentElementUid,
        displayMode: 'Table'
    };

    if( filterMap && filterMapSize > 0 ) {
        var inputData = {
            columnConfigInput: columnConfigInput,
            searchInput: {
                maxToLoad: 150,
                maxToReturn: 150,
                providerName: 'Pm1ResourceListProvider',
                searchCriteria: searchCriteria,
                cursor: {
                    startIndex: dataProvider.startIndex
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: filterMap
            },
            saveColumnConfigData: saveColumnConfigData,
            inflateProperties: inflateProp
        };
    } else {
        var inputData = {
            columnConfigInput: columnConfigInput,
            searchInput: {
                maxToLoad: 150,
                maxToReturn: 150,
                providerName: 'Pm1ResourceListProvider',
                searchCriteria: searchCriteria,
                cursor: {
                    startIndex: dataProvider.startIndex
                },
                searchFilterFieldSortType: 'Alphabetical',
                searchFilterMap6: {}
            },
            saveColumnConfigData: saveColumnConfigData,
            inflateProperties: inflateProp
        };
    }

    soaSvc.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', inputData ).then(
        function( response ) {
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }

            var selectedMO = subPanelContext.provider.baseSelection;
            var vmos = [];

            if( response.searchResults && response.searchResults.objects ) {
                var len = response.searchResults.objects.length;

                for( var idx = 0; idx < len; idx++ ) {
                    var vmo = viewModelObjectSvc.createViewModelObject( response.searchResults.objects[ idx ] );
                    vmos.push( vmo );
                }
            }
            occTypeSvc.loadOccTypesInfo( selectedMO, vmos );

            response.searchResults = vmos;

            response.totalLoaded = vmos.length;

            if( !partMfgCtx.parentElement && response.ServiceData && response.ServiceData.plain ) {
                exports.updatePartMfgCtx( response );
            }

            // Collect all the prop Descriptors
            var propDescriptors = [];
            _.forEach( response.searchResults, function( vmo ) {
                _.forOwn( vmo.propertyDescriptors, function( value ) {
                    propDescriptors.push( value );
                } );
            } );

            // Weed out the duplicate ones from prop descriptors
            response.propDescriptors = _.uniq( propDescriptors, false,
                function( propDesc ) {
                    return propDesc.name;
                } );

            if( response.columnConfig && response.columnConfig.columns[ 0 ] ) {
                response.columnConfig.columns[ 0 ].isTableCommand = true;
            }
            if( !response.searchFilterMap6 ) {
                response.searchFilterMap6 = {
                    'BOMLine.bl_occ_type': []
                };
            }
            deferred.resolve( response );
        } );
    return deferred.promise;
};

export const updateStateInfoToUrl = ( searchState, searchStateUpdater ) => {
    let commandId = appCtxSvc.ctx.activeNavigationCommand ? appCtxSvc.ctx.activeNavigationCommand.commandId : undefined;
    if( searchState.name === 'resourcesState' && commandId === 'Pm1OccTypeFilter' ||
        searchState.name === 'attachmentsState' && commandId === 'Pm1DatasetTypeFilter' ) {
        let searchStateProp = undefined;
        let
            skipURL = undefined;
        updateURL( searchStateProp, searchState, { searchState: searchStateUpdater[ searchState.name ] }, skipURL );
    }
};

export const updatePWASelectionInfo = ( searchState, selectionInfo ) => {
    let searchData = { ...searchState.value };
    searchData.pwaSelection = selectionInfo.selected;
    searchState.update( { ...searchData } );
};

export let updatePartMfgCtx = function( response ) {
    var plen = response.ServiceData.plain.length;
    if( plen > 0 ) {
        var parentElementUid = response.ServiceData.plain[ plen - 1 ];
        var productContextUid = response.ServiceData.plain[ plen - 2 ];
        var parentElemVmo = viewModelObjectSvc.createViewModelObject( parentElementUid );
        var prodContextVmo = viewModelObjectSvc.createViewModelObject( productContextUid );
        appCtxSvc.updatePartialCtx( 'PartMfg.parentElementUid', parentElementUid );
        appCtxSvc.updatePartialCtx( 'PartMfg.parentElement', parentElemVmo );
        appCtxSvc.updatePartialCtx( 'PartMfg.productContext', prodContextVmo );
        var supportedFeatures = getSupportedFeatures( prodContextVmo );
        appCtxSvc.updatePartialCtx( 'PartMfg.supportedFeatures', supportedFeatures );
    }
};

export const loadResourcesColumns = ( dataProvider ) => {
    _promiseColumnConfig = AwPromiseService.instance.defer();

    var soaInput = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            clientName: 'AWClient',
            resetColumnConfig: false,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Pm1Resources',
                operationType: 'configured'
            } ],
            businessObjects: ''
        } ]
    };

    soaSvc.postUnchecked( 'Internal-AWS2-2022-06-UiConfig', 'getOrResetUIColumnConfigs3', soaInput ).then(
        function( response ) {
            // Process returned column data

            var columns;

            if( _isArrayPopulated( response.columnConfigurations ) ) {
                var columnConfigurations = response.columnConfigurations[ 0 ];

                if( _isArrayPopulated( columnConfigurations.columnConfigurations ) ) {
                    columnConfigurations = columnConfigurations.columnConfigurations;

                    if( _isArrayPopulated( columnConfigurations ) ) {
                        columns = _processUiConfigColumns( columnConfigurations[ 0 ].columns );
                    }
                }
            }
            _resourcesColConfigData = { columnInfos: columns };

            _promiseColumnConfig.resolve();
        },
        function( error ) {
            _promiseColumnConfig.reject( error );
        } );

    return promiseColumnConfig().then( function() {
        dataProvider.columnConfig = {
            columns: _resourcesColConfigData.columnInfos
        };

        return _resourcesColConfigData;
    } );
};

export let downloadActivityFiles = function( commandContext ) {
    var deferred = AwPromiseService.instance.defer();
    var datasetList = [];
    var fileCount = 0;

    var selection = commandContext.searchState.pwaSelection;

    _.forEach( selection, function( vmo ) {
        var modelObj = cdm.getObject( vmo.uid );
        if( modelObj.modelType.typeHierarchyArray.indexOf( 'Dataset' ) > -1 ) {
            datasetList.push( modelObj );
        } else if( containChildren( modelObj ) ) {
            datasetList.push.apply( datasetList, getNextLevelDatasets( modelObj ) );
        }
    } );
    fileCount = datasetList.length;
    if( fileCount > 0 ) {
        downloadAttachments( datasetList, deferred );
    } else {
        const zeroCompileMsgs = localeService.getLoadedText( 'ZeroCompileCommandMessages' );
        const msg = zeroCompileMsgs.dataSetCannotBeDownloaded.format( selection[ 0 ].props.object_string.dbValues[ 0 ] );
        msgSvc.showInfo( msg );
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Downloads given attachment files
 * @param {Object[]} files files
 */
function downloadAttachments( files, deferred ) {
    var fileNamesAndTickets = [];
    ensureFilesRefListLoaded( files )
        .then(
            () => {
                const updatedFileObjects = files.map( ( file ) => cdm.getObject( file.uid ) );
                const imanFileUids = [];
                updatedFileObjects.forEach( ( file ) => imanFileUids.push( ...file.props.ref_list.dbValues ) );
                const imanFiles = imanFileUids.map( ( uid ) => cdm.getObject( uid ) ).filter( ( obj ) => Boolean( obj ) );
                if( imanFiles.length > 0 ) {
                    return soaSvc.postUnchecked( 'Core-2006-03-FileManagement', 'getFileReadTickets', { files: imanFiles } );
                }
                const zeroCompileMsgs = localeService.getLoadedText( 'ZeroCompileCommandMessages' );
                const msg = zeroCompileMsgs.dataSetCannotBeDownloaded.format( files[ 0 ].props.object_string.dbValues[ 0 ] );
                msgSvc.showInfo( msg );
                deferred.resolve( {
                    fileNamesAndTickets: fileNamesAndTickets
                } );
            }
        )
        .then(
            ( ticketsResponse ) => {
                if( ticketsResponse && ticketsResponse.tickets && ticketsResponse.tickets.length > 1 ) {
                    const imanFiles = ticketsResponse.tickets[ 0 ];
                    fileNamesAndTickets = imanFiles.map( ( imanFile, index ) => {
                        let fileName = imanFile.props.original_file_name.uiValues[ 0 ];
                        return {
                            fileName,
                            fileTicket: ticketsResponse.tickets[ 1 ][ index ]
                        };
                    } );
                    deferred.resolve( {
                        fileNamesAndTickets: fileNamesAndTickets
                    } );
                }
                deferred.resolve( {
                    fileNamesAndTickets: fileNamesAndTickets
                } );
            }
        );
}

function getNextLevelDatasets( activityLine ) {
    var datasetObjs = [];
    var children = activityLine.props.me_cl_child_lines;
    for( var ind = 0; ind < children.dbValues.length; ind++ ) {
        var childLine = cdm.getObject( children.dbValues[ ind ] );
        if( childLine.type === 'CfgActivityLine' && containChildren( childLine ) ) {
            datasetObjs.push.apply( datasetObjs, getNextLevelDatasets( childLine ) );
        } else if( childLine.type === 'CfgAttachmentLine' ) {
            var underlyingObj = cdm.getObject( childLine.props.al_object.dbValues[ 0 ] );
            if( underlyingObj.modelType.typeHierarchyArray.indexOf( 'Dataset' ) > -1 ) {
                datasetObjs.push( underlyingObj );
            }
        }
    }
    return datasetObjs;
}

/**
 *
 * @param {dataset[]} files - dataset files
 * @returns {promise} a promise object
 */
function ensureFilesRefListLoaded( files ) {
    const fileUids = files.map( ( file ) => file.uid );
    return dataManagementSvc.getProperties( fileUids, [ 'ref_list' ] );
}

function getSupportedFeatures( productContextInfo ) {
    var supportedFeaturesFromPCI = {};
    var supportedFeaturesObjects = null;
    if( productContextInfo && productContextInfo.props ) {
        supportedFeaturesObjects = productContextInfo.props.awb0SupportedFeatures;
    }

    if( supportedFeaturesObjects ) {
        for( var objIndex = 0; objIndex < supportedFeaturesObjects.dbValues.length; objIndex++ ) {
            var featureObject = cdm.getObject( supportedFeaturesObjects.dbValues[ objIndex ] );

            if( featureObject.type === 'Awb0FeatureList' ) {
                var availableFeatures = featureObject.props.awb0AvailableFeatures;
                for( var feature = 0; feature < availableFeatures.dbValues.length; feature++ ) {
                    supportedFeaturesFromPCI[ availableFeatures.dbValues[ feature ] ] = true;
                }
            } else {
                if( featureObject.type ) {
                    supportedFeaturesFromPCI[ featureObject.modelType.name ] = true;
                }
            }
        }
    }
    return supportedFeaturesFromPCI;
}

/**
 * _isArrayPopulated
 *
 * @param{Object} object Input for which array is to be checked.
 * @return{boolean} true if the array is populated
 */
function _isArrayPopulated( object ) {
    var isPopulated = false;
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

/**
 * _processUiConfigColumns
 *
 * @param {Object} columns Columns for the tree.
 * @return {Columns} List of columns
 */
function _processUiConfigColumns( columns ) {
    var _treeColumnInfos = [];
    var colInfoParams = {};
    for( var idx = 0; idx < columns.length; ++idx ) {
        if( columns[ idx ].propertyName === 'awb0OccType' ) {
            colInfoParams = {
                name: columns[ idx ].propertyName,
                propertyName: columns[ idx ].propertyName,
                displayName: columns[ idx ].displayName,
                typeName: columns[ idx ].typeName,
                maxWidth: 400,
                minWidth: 60,
                hiddenFlag: columns[ idx ].hiddenFlag,
                pixelWidth: columns[ idx ].pixelWidth,
                width: columns[ idx ].pixelWidth,
                enableCellEdit: false,
                enableColumnMenu: false,
                enableFiltering: false,
                enablePinning: false,
                enableColumnMoving: false,
                renderingHint: 'OccTypePicker'
            };
        } else {
            colInfoParams = {
                name: columns[ idx ].propertyName,
                propertyName: columns[ idx ].propertyName,
                displayName: columns[ idx ].displayName,
                typeName: columns[ idx ].typeName,
                maxWidth: 400,
                minWidth: 60,
                hiddenFlag: columns[ idx ].hiddenFlag,
                pixelWidth: columns[ idx ].pixelWidth,
                width: columns[ idx ].pixelWidth,
                enableCellEdit: false,
                enableColumnMenu: true,
                enableFiltering: false,
                enablePinning: true,
                enableColumnMoving: true
            };
        }

        var columnInfo = awColumnSvc.createColumnInfo( colInfoParams );

        _treeColumnInfos.push( columnInfo );
    }
    return _treeColumnInfos;
}

/**
 * promiseColumnConfig
 *
 * @returns {Promise} promise
 */
function promiseColumnConfig() {
    var deferred = AwPromiseService.instance.defer();
    if( _promiseColumnConfig.promise ) {
        _promiseColumnConfig.promise.then(

            function() {
                deferred.resolve();
            },
            function() {
                deferred.reject();
            } );
    } else {
        deferred.reject();
    }

    return deferred.promise;
}

/**
 * Part Manufacturing Service
 */
export default exports = {
    registerContext,
    unregisterContext,
    loadTreeTableProperties,
    loadActivitiesData,
    loadAttachmentsData,
    handleTabSelectionChange,
    loadResourcesData,
    updateStateInfoToUrl,
    updatePartMfgCtx,
    updatePWASelectionInfo,
    loadResourcesColumns,
    downloadActivityFiles
};
