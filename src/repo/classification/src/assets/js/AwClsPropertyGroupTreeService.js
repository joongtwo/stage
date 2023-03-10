// Copyright (c) 2021 Siemens

/**
 * @module js/AwClsPropertyGroupTreeService
 */
import _ from 'lodash';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import uwPropertyService from 'js/uwPropertyService';
import classifyFilterUtils from 'js/classifyFilterUtils';
import classifyDefinesSvc from 'js/classifyDefinesService';
import iconSvc from 'js/iconService';

var exports = {};

let createTreeVmNode = function( group, childIndex, parentId, children, hasBlockChildren ) {
    var vmNode = awTableSvc.createViewModelTreeNode( group.id, '', group.name, group.level, childIndex, '' );
    vmNode.attrVmo = group;
    vmNode.isEditable = false;
    vmNode.props = vmNode.props ? vmNode.props : [];
    var vmProperty = uwPropertyService.createViewModelProperty( 'PropGroup', 'PropGroup', 'STRING', '', '' );
    vmNode.props.PropGroup = vmProperty;
    vmNode.iconURL = group.cardinalController ? iconSvc.getTypeIconFileUrl( 'indicatorCardinalProperty16.svg' ) : group.polymorphicTypeProperty || group.polymorphicTypePropertyKeyLov ? iconSvc.getTypeIconFileUrl( 'indicatorPolymorphicProperty16.svg' ) : null;
    vmNode.parentId = parentId;
    vmNode.isLeaf = true;
    if ( children ) {
        vmNode.children = children;
        vmNode.childCount = vmNode.children.length;
        vmNode.isLeaf = vmNode.childCount === 0;
        vmNode.isExpanded = !vmNode.isLeaf;
    }
    if ( hasBlockChildren !== undefined ) {
        vmNode.isLeaf = !hasBlockChildren;
        vmNode.isExpanded = false;
    }
    return vmNode;
};

let searchPropertyGroupNodes = function( attributes, parentId ) {
    let vmNodes = [];

    _.forEach( attributes, function( group, i ) {
        if ( group.type === 'Block' && group.visible ) {
            let children = group.children && group.children.length > 0 ? searchPropertyGroupNodes( group.children, group.id ) : [];
            let instances = group.instances && group.instances.length > 0 ? searchPropertyGroupNodes( group.instances, group.id ) : [];
            children = children.concat( instances );
            let vmNode = createTreeVmNode( group, i, parentId, children );
            vmNodes.push( vmNode );
        }
    } );

    return vmNodes;
};

let createPropertyGroupNodes = function( attributes, treeLoadInput ) {
    let vmNodes = [];

    _.forEach( attributes, function( group, i ) {
        if ( group.type === 'Block' ) {
            let vmNode = createTreeVmNode( group, i, treeLoadInput.parentNode.id, null, group.hasBlockChildren );
            vmNodes.push( vmNode );
        }
    } );

    return vmNodes;
};

let filterPropertyGroupNodes = function( attributes, classifyState, filterString ) {
    let vmNodes = [];
    let filteredAtrrs = classifyFilterUtils.filterPropGroups( attributes, filterString );
    let vmtNodes = searchPropertyGroupNodes( filteredAtrrs, classifyDefinesSvc.ROOT_LEVEL_ID );
    let queue = [];
    for ( let i = 0; i < vmtNodes.length; i++ ) {
        queue.push( vmtNodes[ i ] );
    }
    while ( queue.length > 0 ) {
        let vmNode = queue.shift();
        vmNodes.push( vmNode );
        for ( let i = 0; i < vmNode.children.length; i++ ) {
            queue.push( vmNode.children[ i ] );
        }
    }
    selectPropertyGroup( classifyState, undefined, filteredAtrrs );
    return vmNodes;
};

/**
 * We are using below function when tree needs to be created . Same function will be used in both initialize and next action mode.
 * We need to use it for expanding the tree as well.
 * @param {object} treeLoadInput Tree load input
 * @param {object} data Declarative view model
 * @param {string} classifyState Struct containing class information
 * @param {string} filterString Filer string input
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let getTreeStructure = function( treeLoadInput, data, classifyState, filterString ) {
    data.providerName = 'propertyGroupDataProvider';

    let deferred = AwPromiseService.instance.defer();
    if ( !treeLoadInput ) {
        return deferred.promise;
    }
    treeLoadInput.pageSize = Number.MAX_SAFE_INTEGER;
    treeLoadInput.retainTreeExpansionStates = false;
    treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    data.treeLoadInput = treeLoadInput;
    data.treeLoadInput.displayMode = 'Tree';

    let attributes = classifyState.attrs;
    let failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if ( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }

    let finalVMTNodes = [];
    if ( filterString ) {
        finalVMTNodes = filterPropertyGroupNodes( attributes, classifyState, filterString );
    } else {
        if ( classifyState.selectedPropertyGroup ) {
            selectPropertyGroup( classifyState );
        }
        let allAttrs = treeLoadInput.parentNode && treeLoadInput.parentNode.attrVmo && treeLoadInput.parentNode.attrVmo.children ?
            treeLoadInput.parentNode.attrVmo.children.concat( treeLoadInput.parentNode.attrVmo.instances ? treeLoadInput.parentNode.attrVmo.instances : [] ) : [];
        finalVMTNodes = createPropertyGroupNodes( treeLoadInput.parentNode.id === classifyDefinesSvc.ROOT_LEVEL_ID ? attributes : allAttrs, treeLoadInput );
    }

    let treeLoadResult;
    treeLoadResult = awTableSvc.buildTreeLoadResult( data.treeLoadInput, finalVMTNodes, false, true, true, null );

    deferred.resolve( {
        treeLoadResult: treeLoadResult
    } );
    return deferred.promise;
};

/**
 * Loads columns for the column
 * @return {object} promise for async call
 */
export let loadColumns = function( ) {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [];

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'PropGroup',
        isTreeNavigation: true,
        isTableCommand: false,
        enableSorting: false,
        enableCellEdit: false,
        width: 200,
        minWidth: 200,
        enableColumnResizing: false,
        enableColumnMoving: false,
        enableFiltering: false,
        frozenColumnIndex: -1
    } ) );

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};


/**
 * Load properties to be shown in the tree structure
 * @param {Object} propertyLoadInput - Property Load Input
 * @return {object} promise for async call
 */
export let loadPropertiesJS = function( propertyLoadInput ) {
    var allChildNodes = [];
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if ( propertyLoadInput ) {
        _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
            _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
                if ( !childNode.props ) {
                    childNode.props = {};
                }
                if ( childNode.id !== classifyDefinesSvc.ROOT_LEVEL_ID ) {
                    allChildNodes.push( childNode );
                }
            } );
        } );

        var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

        return AwPromiseService.instance.resolve( {
            propertyLoadResult: propertyLoadResult
        } );
    }
};

/**
 * We are using below function when tree needs to be created . Same function will be used in both initialize and next action mode.
 * We need to use it for expanding the tree as well.
 * @param {string} classifyState Struct containing class information
 * @param {string} eventData Event data object
 * @param {string} filteredAtrrs Array of filtered attributes
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let selectPropertyGroup = function( classifyState, eventData, filteredAtrrs ) {
    let updateMode = classifyState.value.panelMode !== -1;
    const updateInstances = function( attribute ) {
        _.forEach( attribute.instances, function( instance ) {
            instance.children = updateChildren( instance.children );
        } );
        return attribute.instances;
    };

    const updateChildren = function( attributes ) {
        _.forEach( attributes, function( child ) {
            if ( child.type === 'Block' ) {
                updateInstances( child );
            } else {
                child.vmps[0].isEditable = updateMode;
            }
        } );
        return attributes;
    };

    const tempValue = { ...classifyState.value };
    if ( filteredAtrrs ) {
        tempValue.selectedPropertyGroup = filteredAtrrs;
    } else {
        var selectedPropertyGroup = classifyState.value.selectedPropertyGroup;
        if ( eventData ) {
            selectedPropertyGroup = eventData && eventData.selected[ 0 ] && eventData.selected[ 0 ].attrVmo ? [ eventData.selected[ 0 ].attrVmo ] : undefined;
        }
        if ( selectedPropertyGroup ) {
            //reset edit flag for each of the children
            updateChildren( selectedPropertyGroup[0].children );
        }
        tempValue.selectedPropertyGroup = selectedPropertyGroup;
    }
    if( tempValue.selectedPropertyGroup !== classifyState.value.selectedPropertyGroup ) {
        classifyState.update( tempValue );
    }
};


/**
 * We are using below function when tree needs to be updated.
 * @param {object} dataProvider - Data provider
 * @param {object} classifyState -classifyState
 */
export let updatePropGroupDataProvider = function( dataProvider, classifyState ) {
    var selectedAttribute = classifyState.selectedCardinalAttribute;
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs;
    if ( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if ( classifyState.value.panelMode === -1 &&
        ( classifyState.value.cancelEdits === true ||
           !classifyState.value.selectedPropertyGroup && dataProvider.selectedObjects.length > 0  ) ) {
        //if edit cancelled or saved, clear propgroup selection
        resetSelection( dataProvider, classifyState );
        return;
    }
    var vmoId = vmc.findViewModelObjectById( selectedAttribute.id );
    if ( vmoId > -1 && loadedVMOs && loadedVMOs[ vmoId ] ) {
        var parentVMO = loadedVMOs[ vmoId ];

        let attrs = selectedAttribute.children.concat( selectedAttribute.instances );

        parentVMO.children = searchPropertyGroupNodes( attrs, selectedAttribute.id );
        if ( parentVMO && parentVMO.children ) {
            if ( parentVMO.children.length > 0 ) {
                parentVMO.isLeaf = false;
            }else{
                parentVMO.isLeaf = true;
            }

            if ( parentVMO.isExpanded === true ) {
                // clear the instances from loaded vmos
                loadedVMOs = loadedVMOs.filter( function( vmo ) {
                    return vmo.parentId !== parentVMO.id;
                } );

                var idx = _.findLastIndex( loadedVMOs, function( vmo ) {
                    return vmo.uid === selectedAttribute.id;
                } );

                // populate the instances again
                _.forEach( parentVMO.children, function( childNode ) {
                    loadedVMOs.splice( ++idx, 0, childNode );
                } );
            }else{
                parentVMO.children = [];
            }
        }
        dataProvider.update( loadedVMOs );
    }
};

/**
 * Reset selection in data provider.
 * @param {object} dataProvider - Data provider
 */
export let resetSelection = function( dataProvider, classifyState ) {
    dataProvider.selectNone();
    dataProvider.resetDataProvider();
};


export default exports = {
    getTreeStructure,
    loadColumns,
    loadPropertiesJS,
    resetSelection,
    selectPropertyGroup,
    updatePropGroupDataProvider
};
