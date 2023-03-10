// Copyright (c) 2022 Siemens

/**
 * @module js/partMfgTreeTableService
 */
import appCtxSvc from 'js/appCtxService';
import awIconSvc from 'js/awIconService';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import occTypeSvc from 'js/occurrenceTypesService';
import policySvc from 'soa/kernel/propertyPolicyService';
import partMfgSvc from 'js/partManufacturingService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';

var exports = {};

export let loadResourcesData = function( treeLoadInput, columnConfigInput, inflateProp, subPanelContext ) {
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

    _buildResourceStructure( treeLoadInput.parentNode, deferred, treeLoadInput, columnConfigInput, inflateProp, subPanelContext );
    return deferred.promise;
};

/**
 * @param {ViewModelTreeNode} parentNode - A node that acts as 'parent' of a hierarchy of 'child'
 *            ViewModelTreeNodes.
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ColumnConfigInput} columnConfigInput - Column Configuration Input
 * @param {inflateProp} inflateProp - If true, the properties will be inflated (the properties will be loaded and fully populated).
 *
 */
function _buildResourceStructure( parentNode, deferred, treeLoadInput, columnConfigInput, inflateProp, subPanelContext ) {
    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );
    var selectedMO = subPanelContext.provider.baseSelection;

    var targetNode = parentNode.isExpanded ? parentNode.uid : undefined;

    var parentElementUid = '';
    if( parentNode.isExpanded ) {
        parentElementUid = parentNode.uid;
    } else if( partMfgCtx.parentElementUid ) {
        parentElementUid = partMfgCtx.parentElementUid;
    }

    var productContextUid = partMfgCtx.productContext ? partMfgCtx.productContext.uid : '';

    var policyID = policySvc.register( {
        types: [ {
            name: 'Awb0Element',
            properties: [ {
                name: 'awb0OccType'
            },
            {
                name: 'awb0UnderlyingObjectType'
            } ]
        },
        {
            name: 'Awb0ProductContextInfo',
            properties: [ {
                name: 'awb0SupportedFeatures',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]
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
        } ]
    } );

    var soaInput = {
        inflateProperties: inflateProp,
        columnConfigInput: columnConfigInput,
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Pm1ResourceListProvider',
            searchCriteria: {
                parentUid: selectedMO.uid,
                parentElementUid: parentElementUid,
                productContextInfo: productContextUid,
                displayMode: 'Tree'
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

            var _proxyObjects = [];

            if( response && response.searchResults && response.searchResults.objects ) {
                var len = response.searchResults.objects.length;

                for ( var idx = 0; idx < len; idx++ ) {
                    var awb0Elem = viewModelObjectSvc.createViewModelObject( response.searchResults.objects[idx] );
                    _proxyObjects.push( awb0Elem );
                }
            }
            occTypeSvc.loadOccTypesInfo( selectedMO, _proxyObjects );

            response.searchResults = _proxyObjects;

            response.totalLoaded = _proxyObjects.length;

            if ( !partMfgCtx.parentElement && response.ServiceData && response.ServiceData.plain ) {
                partMfgSvc.updatePartMfgCtx( response );
                partMfgCtx = appCtxSvc.getCtx( 'PartMfg' ); // reload context
            }

            if( !parentNode.isExpanded && response.ServiceData && response.ServiceData.plain ) {
                var plen = response.ServiceData.plain.length;
                if( plen > 0 ) {
                    var newparentNode = createVMNodeUsingObjectInfo( cdm.getObject( partMfgCtx.parentElementUid ), 0, -1 );
                    treeLoadInput.parentNode = newparentNode;
                    treeLoadInput.startChildNdx = 0;
                }
            } else {
                targetNode = parentNode.uid;
                treeLoadInput.startChildNdx = 0;
            }

            var treeLoadResult = processProviderResponse( treeLoadInput, _proxyObjects );
            var treeLoadResult = processProviderResponse( treeLoadInput, response.searchResults );
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
 * @param {occurrenceInfo} obj - Occurrence Information sent by server
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
        if( obj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            var alObj = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
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
        var vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx );
        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }
    var newTopNode = null;
    var treeLoadResult = {};
    if( !treeLoadInput.parentNode.isExpanded ) {
        var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );
        newTopNode = createVMNodeUsingObjectInfo( cdm.getObject( partMfgCtx.parentElementUid ), 0, treeLoadInput.parentNode.levelNdx );
        // Third Paramter is for a simple vs ??? tree
        treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, newTopNode );

        updateTreeLoadResult( treeLoadInput, treeLoadResult );
    } else {
        treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, false, true, true, null );
    }

    return treeLoadResult;
}

function updateTreeLoadResult( treeLoadInput, treeLoadResult ) {
    treeLoadResult.showTopNode = true;

    var rootPathNodes = [];

    var partMfgCtx = appCtxSvc.getCtx( 'PartMfg' );

    rootPathNodes.push( treeLoadResult.newTopNode );
    rootPathNodes.push( createVMNodeUsingObjectInfo( cdm.getObject( partMfgCtx.parentElementUid ), 0, 0 ) );

    treeLoadResult.rootPathNodes = rootPathNodes;

    treeLoadResult.topModelObject = cdm.getObject( partMfgCtx.parentElementUid );
    treeLoadResult.baseModelObject = cdm.getObject( partMfgCtx.parentElementUid );
}

function containChildren( obj ) {
    if( obj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        if( obj.props && obj.props.awb0NumberOfChildren && obj.props.awb0NumberOfChildren.dbValue > 0 ) {
            return true;
        }
        return false;
    }
    return false;
}

/**
 * Tree Table service
 */
export default exports = {
    loadResourcesData
};
