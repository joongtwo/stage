// Copyright (c) 2022 Siemens

/**
 * This is tree component to display classification classes
 *
 * @module js/Awp0ClassificationTreeService
 */
import _ from 'lodash';

import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import awTableStateService from 'js/awTableStateService';
import classifyUtils from 'js/classifyUtils';
import classifyService from 'js/classifyService';
import { SHOW_CHILDREN, HIDE_CHILDREN } from 'js/classifyDefinesService';
import classifyDefinesService from 'js/classifyDefinesService';
import eventBus from 'js/eventBus';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import AwTimeoutService from 'js/awTimeoutService';
import uwPropertyService from 'js/uwPropertyService';
import clsTreeSyncUtils from 'js/classifyTreeSyncUtils';

var exports = {};

var max_safe_number = !Number.MAX_SAFE_INTEGER ? Math.pow( 2, 53 ) - 1 : Number.MAX_SAFE_INTEGER;

/**
 * This makes sure, edited object is selected
 * @param {data} vmCollection the view model collection
 * @param {ArrayList} selectionModel selection model of pwa
 * @param {Object} node can be of two types: treeLoadResult or ViewModelTreeNode.
 * @param {State} state the classify state to update with the selected class node.
 * @param {String} gridToExpandId the id of the grid the expand will defaults to clsTreeTable.
 */
export let updateExternalSelection = function( vmCollection, selectionModel, node, state, gridToExpandId ) {
    if( node ) {
        //Origin from VNCs
        const selectedObject = updateTreeSelection( vmCollection, selectionModel, node, state );
        //If the object has not been properly selected yet, select it. Could be moved into updateTreeSelection
        if( selectedObject && !selectedObject.selected ) {
            if( selectedObject.isLeaf ) {
                //Indicate that no further loading would be necessary.
                //isLeaf verification is supposed to be enough on its own, but:
                //it sets the icon to an empty string, and when toggleTreeNode runs
                //It will display clock unless selectedObject.isExpanded OR icon is undefined.
                selectedObject.isExpanded = true;
            }
            selectionModel.setSelection( selectedObject );
        }
        if( selectedObject && selectedObject._twistieTitle === SHOW_CHILDREN ) {
            eventBus.publish( gridToExpandId + '.plTable.toggleTreeNode', selectedObject );
        }
    }
};

/**
 * This makes sure, edited object is selected
 * @param {data} vmCollection the view model collection
 * @param {ArrayList} selectionModel selection model of pwa
 * @param {Object} node can be of two types: treeLoadResult or ViewModelTreeNode.
 * @param {State} state the classify state to update with the selected class node.
 * @param {Boolean} deselection whether or not this is a deselection update.
 * @param {Boolean} searchString need to reset with a search string available.
 * @returns {Object} selectedObject that has been picked
 */
export let updateTreeSelection = function( vmCollection, selectionModel, node, state, deselection, searchString ) {
    //Could be addressing case from Tree or VNC
    if ( node.uid ) {
        //locate selected class.
        var selectedObject = findSelectedObject( vmCollection, node.uid );

        //Have to refer to '_twistieTitle' as it is the only indicator on a given tree node that it can be expanded.
        //If action being performed is expansion OR selection. Case
        if ( selectedObject && vmCollection.loadedVMObjects.length > 0 && ( selectedObject._twistieTitle === SHOW_CHILDREN || selectedObject._twistieTitle === '' ) ) {
            selectedObject.isExpanded = true;
            //Update selectedClassNode when user selects non-leaf abstract class in VNC
            if( state && ( selectedObject.type === 'Group' || selectedObject.type === 'AbstractClass' ) && state.selectedNode && selectedObject.isLeaf !== state.selectedNode.isLeaf ) {
                updateSelectedClassNode( selectedObject, state );
            }
            return selectedObject;
        }
        //If action being performed is collapse OR selected object is already expanded.
        if ( vmCollection.loadedVMObjects.length > 0 && selectedObject._twistieTitle === HIDE_CHILDREN ) {
            //Selected object is already expanded, select it.
            if( selectedObject && selectedObject.children ) {
                updateSelectedClassNode( selectedObject, state );
                //If the object is selected from the VNCs.
                return selectedObject;
            }
            //Reset the area. No node given for selection.
            clsTreeSyncUtils.resetTree( vmCollection, selectionModel, state, true );

        //if VNC selection that is not already expanded.
        }
    } else if ( selectionModel && deselection ) {
        //Reset the area. Active deselection has ocurred.
        clsTreeSyncUtils.resetTree( vmCollection, selectionModel, state, false, searchString );
    }
    //If external selection, returning false is an error. Else, does nothing.
    return false;
};

/**
 * Find the selected View Model Tree Node.
 *
 * @param {Array} vmCollection view model object collection
 * @param {String} nodeId the selected node's id.
 * @returns {ViewModelObject} result the representation.
 */
export let findSelectedObject = function( vmCollection, nodeId ) {
    return vmCollection.getLoadedViewModelObjects().find( vmo => { return vmo.uid === nodeId; } );
};

/**
 * We are using below function when tree needs to be created
 * We need to use it for expanding the tree as well.
 * @param {Object} treeLoadInput Tree load input
 * @param {Object} data Declarative view model
 * @param {String} providerName Data provider name
 * @param {String} searchString Search string input
 * @param {String} releasesState Struct containing releases information
 * @param {Object} classifyState Struct containing overall tab relevant information
 * @param {Object} sortOption sortOption
 * @param {Object} siblingsResponse Struct containing the response from the sibling SOA call - Optional.
 * @param {Object} processSiblingResponse Struct containing the response from the sibling SOA call - Optional.
 * @param {Object} siblingParentHierarchy Struct that contains the parent Hierarchy
 * @param {String} workspaceObjUid String of uid of current selected workspace object - Optional.
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let getTreeStructure = function( treeLoadInput, data, providerName, searchString,
    releasesState, classifyState, sortOption, siblingsResponse, processSiblingResponse, siblingParentHierarchy, workspaceObjUid ) {
    if( releasesState === undefined ) {
        releasesState = {};
    }
    data.providerName = providerName;

    var deferred = AwPromiseService.instance.defer();
    treeLoadInput.pageSize = max_safe_number;
    treeLoadInput.retainTreeExpansionStates = false;

    treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    data.treeLoadInput = treeLoadInput;
    data.treeLoadInput.displayMode = 'Tree';

    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if ( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }

    buildTreeTableStructure( deferred, data.treeLoadInput, data, searchString, releasesState, classifyState, sortOption, siblingsResponse, processSiblingResponse, siblingParentHierarchy, workspaceObjUid );
    return deferred.promise;
};


/**
 * We are using below function when node needs to be expanded
 * We need to use it for expanding the tree as well.
 * @param {Object} treeLoadInput Tree load input
 * @param {Object} data Declarative view model
 * @param {String} providerName Data provider name
 * @param {String} releasesState Struct containing releases information
 * @param {Object} sortOption Struct containing overall tab relavant information
 * @param {Object} siblingsResponse Struct containig the response from the sibling SOA call. Optional.
 * @param {Object} processSiblingsResponse bool that state where processing
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let getTreeStructureTableForExpand = function( treeLoadInput, data, providerName, releasesState, sortOption, siblingsResponse, processSiblingsResponse ) {
    if( releasesState === undefined ) {
        releasesState = {};
    }
    data.providerName = providerName;

    var deferred = AwPromiseService.instance.defer();

    treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
    data.treeLoadInput = treeLoadInput;
    data.treeLoadInput.displayMode = 'Tree';
    treeLoadInput.pageSize = max_safe_number;
    treeLoadInput.retainTreeExpansionStates = false;

    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if ( failureReason ) {
        deferred.reject( failureReason );

        return deferred.promise;
    }

    if( processSiblingsResponse ) {
        processDefaultResponse( deferred, siblingsResponse, data, treeLoadInput, searchCriteria );
    } else {
        var searchCriteria = {};
        var workspaceObjects = [];

        searchCriteria.searchAttribute = classifyService.UNCT_CLASS_ID;
        searchCriteria.searchString = '';

        if ( treeLoadInput.parentNode.levelNdx === -1 ) {
            searchCriteria.searchString = 'ICM';
        } else {
            searchCriteria.searchString = treeLoadInput.parentNode.id;
        }
        searchCriteria.sortOption = classifyService.UNCT_SORT_OPTION_CLASS_ID;


        var request = {
            workspaceObjects: workspaceObjects,
            searchCriterias: [ searchCriteria ],
            classificationDataOptions: sortOption.fielddata.uiValue !== '' ? sortOption.value : classifyDefinesService.LOAD_CLASS_CHILDREN_ASC
        };

        data.numOfResults = null;

        soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then( function( response ) {
            processDefaultResponse( deferred, response, data, treeLoadInput, searchCriteria );
        } );
    }

    return deferred.promise;
};

/**
 * Updates the currently selected class node in the tree hierarchy.
 * @param {object} treeNode The nodes to update.
 * @param {object} context current context of the tree.
 * @param {object} response data given of class nodes.
 * @param {object} searchString the string used for searching.
 */
export let updateSelectedClassNode = function( treeNode, context, response, searchString ) {
    if ( context ) {
        const tmpContext = { ...context.value };
        if( treeNode && treeNode.props && treeNode.props.classProbability ) {
            //handle suggestion selection.
            //TODO: Would it be more efficient to combine this case with response: else case below?
            tmpContext.selectedSuggestion = treeNode;
        } else{
            if( treeNode !== tmpContext.selectedClassNode || !tmpContext.selectedClassNode ) {
                if( response ) {
                    //If tree is loaded on root OR tree member is selected, update VNC's.
                    clsTreeSyncUtils.resetSelectedToDefault( response, context, searchString );
                } else {
                    //Necessary to get the root node for other SOA calls.
                    tmpContext.selectedClassNode = treeNode;
                    tmpContext.selectedNode = treeNode;
                    context.update( tmpContext );
                }
            }
        }
    }
};


/**
 * Returns the data options to be sent to the findClassificationInfo2 SOA based on sortOption.
 * @param {Object} sortOption - classification state object
 * @return {Number} Returns the classification data option to be sent to server
 */
export let getClassificationDataOptions = function( sortOption, classifyState, loadSuggestions ) {
    var clsDataOption = 0;
    if( loadSuggestions === true ) {
        if( classifyState.isClassifyPanel ) {
            clsDataOption += classifyDefinesService.LOAD_CLASS_CHILDREN_ASC;
        } else {
            clsDataOption += classifyDefinesService.LOAD_CLASS_SUGGESTIONS;
        }
    } else if ( sortOption && sortOption.value  ) {
        clsDataOption += sortOption.value;
    } else {
        clsDataOption += classifyDefinesService.LOAD_CLASS_CHILDREN_ASC;
    }
    return clsDataOption;
};

let buildSearchInput = function( treeLoadInput, data, searchString, releasesState, classifyState, sortOption, workspaceObjUid  ) {
    var searchCriteria = {};
    var clsDataOptValue = 0;
    var workspaceObjects = [];

    var tempReleases = '';

    //when all releases are selected, default tree should be shown
    if ( releasesState.releasesActive === false ) {
        tempReleases = releasesState.releasesString;
        releasesState.releasesString = '';
    }

    searchCriteria.searchAttribute = classifyService.UNCT_CLASS_ID;
    searchCriteria.searchString = '';

    if ( treeLoadInput.parentNode.levelNdx === -1 ) {
        searchCriteria.searchString = 'ICM';
    } else {
        searchCriteria.searchString = treeLoadInput.parentNode.id;
    }
    searchCriteria.sortOption = classifyService.UNCT_SORT_OPTION_CLASS_ID;
    var request = {};

    var releasesActive = releasesState.releasesString !== '' && releasesState.releasesString !== undefined;
    var searchActive = searchString !== '' && searchString !== undefined;
    var defaultSearch = true;

    if ( searchActive || releasesActive ) {
        searchCriteria.searchAttribute = 'CLASSID_SOURCESTANDARD';
        defaultSearch = false;
    }


    if ( searchActive ) {
        request = {
            workspaceObjects: [],
            searchCriterias: classifyService.parseSearchString( searchString ),
            classificationDataOptions: 0
        };
    }
    if ( releasesActive ) {
        if ( searchActive ) {
            request.searchCriterias[0].searchString += releasesState.releasesString;
            request.searchCriterias[0].searchAttribute = 'CLASSNAME_SOURCESTANDARD';
        } else {
            searchCriteria.searchString += releasesState.releasesString;
            request = {
                workspaceObjects: workspaceObjects,
                searchCriterias: [ searchCriteria ],
                classificationDataOptions: clsDataOptValue + getClassificationDataOptions( sortOption )
            };
        }
    }

    if ( !request.searchCriterias ) {
        //default
        request = {
            workspaceObjects: workspaceObjects,
            searchCriterias: [ searchCriteria ],
            classificationDataOptions: getClassificationDataOptions( sortOption )
        };
    }

    //retain the releaseString if all the releases were selected
    if ( releasesState.releasesActive === false ) {
        releasesState.releasesString = tempReleases;
    }

    if( workspaceObjUid && !searchString ) {
        request.classificationDataOptions += classifyDefinesService.LOAD_CLASS_SUGGESTIONS;
        request.workspaceObjects[0] =  {
            uid: workspaceObjUid
        };
    }
    return {
        request,
        defaultSearch,
        searchCriteria
    };
};

let addTemporaryRootToHierarchy = function( parentsList ) {
    var rootNode = {
        attributes: [],
        childCount: 0,
        documents: [],
        properties: classifyUtils.generatePropertiesForClassInfo( 'ICM', 'Classification Root', 'AbstractClass' )
    };
    var rootGroup = {
        attributes: [],
        childCount: 0,
        documents: [],
        properties: classifyUtils.generatePropertiesForClassInfo( 'SAM', 'TC Classification Root', 'AbstractClass' )
    };
    parentsList.push( rootNode );
    parentsList.push( rootGroup );
};

/**
 *
 * @param {*} nodeArray - return to add the resulting node to
 * @param {*} node - The from the SOA response to process
 * @param {*} parentId - the parent ID the node belongs too
 * @param {*} type - the type of the node
 * @param {*} level - the level the node should render at
 * @param {*} releasesState - The release of the class if applicable
 */
function buildNode( nodeArray, node, parentId, type, level, releasesState ) {
    var id = classifyUtils.getPropertyValueFromArray( node.properties, classifyService.UNCT_CLASS_ID );
    var className = classifyUtils.getPropertyValueFromArray( node.properties, classifyService.UNCT_CLASS_NAME );
    var temp = {
        id: id,
        className: className,
        parentid: parentId,
        level: level,
        type: type,
        typeIconFileUrl:classifyService.getIcon( node )
    };

    temp.className = classifyService.modifyForReleaseName( releasesState, node, temp.className );

    if ( !nodeArray[id] ) {
        nodeArray[id] = temp;
        nodeArray[id].children = [];
    }
}

/**
 *
 * @param {Object} mappedElem Elems that contain the information to build the node from
 * @param {String} imageIconUrl The url of the image to be used for the VMTreeNode
 * @param {Number} length level of indent the node should have. 0 for root 1 for just under root etc.
 * @returns {ViewModeTreeNode} vmNode
 */
function createVmNode( mappedElem, imageIconUrl, length ) {
    var vmNode = awTableSvc.createViewModelTreeNode(
        mappedElem.id,
        '',
        mappedElem.className,
        mappedElem.level - 2,
        length,
        '' );
    vmNode.isLeaf = false;
    vmNode.childCount = mappedElem.childCount;
    vmNode.parent_Id = mappedElem.parentid;
    vmNode.parentDisplayName = mappedElem.className;
    vmNode.isExpanded = true;
    vmNode.children = mappedElem.children;
    vmNode.iconURL = imageIconUrl;
    vmNode.type = mappedElem.type;
    return vmNode;
}

/*
 * Loads the next level of children to display on vnc
 *
 * @param {Object} data The declarative viewModel data
 * @param {String} providerName data provider name
 */
let getNextLevelChildrenForTree = function( data, providerName ) {
    var serchingCriterias = [];
    if ( data.childrenClsClassDescriptors &&
            data.selectedTreeNode &&
            data.selectedTreeNode.id &&
            data.childrenClsClassDescriptors[data.selectedTreeNode.id] &&
            data.childrenClsClassDescriptors[data.selectedTreeNode.id].documents &&
            !data.clsImageLoaded
    ) {
        data.datasetFilesOutput = data.childrenClsClassDescriptors[data.selectedTreeNode.id].documents;
    }


    if ( data.currentLevel && data.currentLevel.children && data.currentLevel.children.length > 0 ) {
        data.currentLevel.children.forEach( function( childClass ) {
            // If we do not fetch data for leaf level children classes, it would also not load the class description(Class description are to be shown in VNC if they exist)
            var searchCriteria = {};
            searchCriteria.searchAttribute = classifyService.UNCT_CLASS_ID;
            searchCriteria.searchString = childClass.id;
            searchCriteria.sortOption = classifyService.UNCT_SORT_OPTION_CLASS_ID;
            serchingCriterias.push( searchCriteria );
        } );
    }
    var soaPromise;

    // 1a. If child exist and children to be fetched from server, then perform SOA call
    // 1b. If no child exist for fetching information, then do not perform any SOA call as it would be an empty SOA call
    // 2. Perform some common activities which should be done irrespective of whether SOA call is made or not.
    if ( serchingCriterias.length >= 1 ) {
        var request = {
            workspaceObjects: [],
            searchCriterias: serchingCriterias,
            classificationDataOptions: classifyDefinesService.LOAD_CLASS_CHILDREN_ASC
        };

        soaPromise = soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request )
            .then( function( response ) {
                if ( response.clsClassDescriptors ) {
                    data.childrenClsClassDescriptors = response.clsClassDescriptors;
                }
                for ( var currentClassId in response.clsClassDescriptors ) {
                    var currentClassDescriptor = response.clsClassDescriptors[currentClassId];

                    if ( data.currentLevel && !data.currentLevel.children ) {
                        data.currentLevel.children = [];
                    }
                    var classItemToUpdate = data.currentLevel.children.filter( ( currentParentItem ) => {
                        return currentParentItem.id === currentClassId;
                    } );

                    if ( classItemToUpdate.length === 1 ) {
                        classItemToUpdate[0].classDescription = classifyService.getPropertyValue( currentClassDescriptor.properties, classifyService.UNCT_CLASS_DESCRIPTION );
                    }
                }

                var searchActive = false;
                // Check if search is active
                if ( data && data.searchBox && data.searchBox.dbValue && data.searchBox.dbValue !== '' ) {
                    searchActive = true;
                }
                for ( var i = 0; i < data.currentLevel.children.length; i++ ) {
                    var firstLvlChild = data.currentLevel.children[i];
                    var secondLevelChildren = [];
                    var secLvlChildren = [];
                    var classID = firstLvlChild.id;
                    if ( response && response.classChildren && response.classChildren[classID] &&
                        response.classChildren[classID].children ) {
                        secLvlChildren = response.classChildren[classID].children;
                    }

                    var parentTreeNode = null;
                    if ( searchActive ) {
                        // Get the tree node for the current classID
                        parentTreeNode = exports.getTreeNodeFromClassId( data, providerName, classID );
                    }

                    secLvlChildren.forEach( ( secLvlChildObj ) => {
                        var secLvlChildId = classifyService.getPropertyValue( secLvlChildObj.properties, classifyService.UNCT_CLASS_ID );

                        // If search is active then add secLvlChildId only if it is to be added to firstLvlChild.children
                        if ( searchActive && !exports.checkIfChildClassToBeAddedToVNC( parentTreeNode, secLvlChildId ) ) {
                            return;
                        }

                        var secLvlChildName = classifyService.getPropertyValue( secLvlChildObj.properties, classifyService.UNCT_CLASS_NAME );
                        var vmProperty = uwPropertyService.createViewModelProperty( secLvlChildId, secLvlChildName, 'STRING', '', '' );
                        vmProperty.className = secLvlChildName;
                        var parentInfo = {
                            $$hashKey: firstLvlChild.$$hashKey,
                            childCount: firstLvlChild.childCount,
                            className: firstLvlChild.className,
                            id: firstLvlChild.id,
                            typeIconFileUrl: firstLvlChild.typeIconFileUrl,
                            type: firstLvlChild.type
                        };
                        vmProperty.parent = parentInfo;
                        classifyService.parseIndividualClassDescriptor( secLvlChildObj, true, vmProperty );
                        secondLevelChildren.push( vmProperty );
                    } );

                    firstLvlChild.children = [];
                    firstLvlChild.children = secondLevelChildren;
                    data.currentLevel.children[i].children = [];
                    data.currentLevel.children[i].children = secondLevelChildren;
                }
            } );
    } else {
        data.childrenClsClassDescriptors = [];
        soaPromise = new Promise( function( resolve ) {
            AwTimeoutService.instance( () => {
                resolve();
            }, 0 );
        } );
    }

    /**
     * Common code which is to be called after second level VNC is loaded
     * @param {Object} data data
     */
    function vncLoadCompleted( data ) {
        data.isClsSearchButtonVisible = true;
        // At this point, tree and VNCs are loaded. Safe to fire event for performing any expansion
        // Not sure if this is required anymore. But keeping it as is
        eventBus.publish( data.providerName + '.performClassExpansion' );
    }

    return soaPromise.then( ( ) => vncLoadCompleted( data ) );
};

/**
 *
 * @param {Promise} deferred - The deferred promise of a tree result
 * @param {Object} response - The SOA response object from get siblings SOA call
 * @param {Object} data - Awp0ClassificationTreeViewModel data object
 * @param {Object} treeLoadInput - Tree load input. Input that is given from the data provider of the tree
 * @param {Object} targetHierarchy - The parent Hierarchy of the target class
 * @returns {*} result - Not sure why JS Doc is forcing me to add a return... this function is a void function that resolve a Promise
 */
function buildTreeForExpandToTargetClass( deferred, response, data, treeLoadInput, targetHierarchy ) {
    if ( !response.classParents ) {
        return processRejectedResponse( deferred, data, treeLoadInput, tempCursorObject );
    }

    let tempCursorObject = {
        endReached: true,
        startReached: true
    };

    let classChildren = response.classChildren;

    // In order to tell if we are dealing with next generation or traditional classification
    // we check to see if the classChildren part of the response from findInfo3 contains Cls0DefaultView
    let nextGenClassification = Object.keys( classChildren ).includes( classifyDefinesService.CLS0_DEFAULT_VIEW );

    // Generate the root node of the tree. If we are handling next gen classification then we want to process all the
    // children under Cls0DefaultView otherwise we want to process all the children under ICM.
    let rootNodes = nextGenClassification ?
        classifyService.getChildren( response, true, [ classifyDefinesService.CLS0_DEFAULT_VIEW ] ) :
        classifyService.getChildren( response, true, [ classifyDefinesService.CLASSIFICATION_ICM ] );

    let rootVMNodes = convertToVMNodes( rootNodes, treeLoadInput );

    // Generate the children node for the tree as well as handle what depth the child node should be at.
    let childVMNodes = nextGenClassification ?
        processNextGenResult( response, treeLoadInput, targetHierarchy ) :
        processTraditionalResult( response, treeLoadInput, targetHierarchy );

    while( Object.keys( targetHierarchy ).length > 1 ) {
        rootVMNodes.forEach( ( rootVMNode, rootIndex ) => {
        //Grab all the children for every root node.
            childVMNodes.forEach( ( childNode ) => {
            //If the child's ID matches this root node, run the appropriate code.
                if ( targetHierarchy[rootVMNode.id] && rootVMNode.id === childNode.parent_Id ) {
                //Should only ever run once.
                    childNode.levelNdx = targetHierarchy[rootVMNode.id].depth;
                    childNode.$$treeLevel = targetHierarchy[rootVMNode.id].depth;
                    rootVMNode.children = rootVMNode.children ? rootVMNode.children : [];
                    rootVMNode.children.push( childNode );
                }
            } );

            // Processing of the parent nodes.
            if ( targetHierarchy[rootVMNode.id] ) {
                delete targetHierarchy[rootVMNode.id];
                if( rootVMNode.children && rootVMNode.children.length > 0 ) {
                    // Expand the parent classes.
                    rootVMNode.isExpanded = true;
                    // Persevere the order of children that was received from the server.
                    let sortChildren = [];
                    classChildren[rootVMNode.id].children.forEach( ( child ) => {
                        let classID = child.properties.find( ( property ) => {
                            return property.propertyId === classifyDefinesService.CLASS_ID_PROPERTY;
                        } ).values[0].internalValue;
                        sortChildren.push( rootVMNode.children.find( ( childNode ) => {
                            return childNode.id === classID;
                        } ) );
                    } );
                    // Change the parent array to the sorted array.
                    rootVMNode.children = sortChildren;
                    // Add the children to the root of the tree under their parent
                    rootVMNode.children.forEach( ( childNode, childNodeIndex ) => {
                        rootVMNodes.splice( rootIndex + childNodeIndex + 1, 0, childNode );
                    } );
                }
            }
        } );
    }

    publishTree( data, treeLoadInput, response, rootVMNodes, tempCursorObject, deferred );
}


let processRejectedResponse = ( deferred, data, treeLoadInput, tempCursorObject ) => {
    treeLoadInput = Object.assign( {}, data.treeLoadInput );
    treeLoadInput.parentNode.cursorObject = tempCursorObject;
    var treeLoadEmptyResult = awTableSvc.buildTreeLoadResult( treeLoadInput, [], false, true, true, null );
    deferred.resolve( {
        treeLoadResult: treeLoadEmptyResult
    } );
    data.currentLevel = {
        children: []
    };
    data.initialHierarchy = data.currentLevel;
    return deferred.promise;
};

/**
 *
 * @param {*} response - findClassificationInfo3 Response
 * @param {*} treeLoadInput - The target hierarchy that we are trying to build
 * @param {*} targetHierarchy - Tree load input. Input that is given from the data provider of the tree
 * @returns {*} childVMNodes
 */
function processTraditionalResult( response, treeLoadInput, targetHierarchy ) {
    let childVMNodes = [];
    let classChildren = response.classChildren;
    let parentResults = response.classParents;
    delete parentResults[classifyDefinesService.CLASSIFICATION_SAM];
    delete targetHierarchy[classifyDefinesService.CLASSIFICATION_SAM];
    delete classChildren[classifyDefinesService.CLASSIFICATION_SAM];
    Object.entries( classChildren ).forEach( ( [ parentID ] ) => {
        if ( parentID !== classifyDefinesService.ICM ) {
            let childNodes = classifyService.getChildren( response, true, [ parentID ] );
            childVMNodes.push( ...convertToVMNodes( childNodes, treeLoadInput, parentID ) );
        }
    } );

    Object.entries( parentResults ).forEach( ( [ classID, parents ] ) => {
        //Add root level member and initialized members. Necessary for suggestions.
        if( targetHierarchy[classID] || !parents.parents.length ) {
            targetHierarchy[classID] = { parentID: targetHierarchy[classID], depth: parents.parents.length - 1 };
        }
    } );

    return childVMNodes;
}

/**
 *
 * @param {*} response - findClassificationInfo3 Response
 * @param {*} treeLoadInput - Tree load input. Input that is given from the data provider of the tree
 * @param {*} targetHierarchy - The target hierarchy that we are trying to build
 * @returns {Array<vmNode>} childVMNodes
 */
function processNextGenResult( response, treeLoadInput, targetHierarchy ) {
    let childVMNodes = [];
    let classChildren = response.classChildren;
    let parentResults = response.classParents;
    Object.entries( classChildren ).forEach( ( [ parentID ] ) => {
        if ( parentID !== classifyDefinesService.CLS0_DEFAULT_VIEW ) {
            let childNodes = classifyService.getChildren( response, true, [ parentID ] );
            childVMNodes.push( ...convertToVMNodes( childNodes, treeLoadInput, parentID ) );
        }
    } );
    Object.entries( parentResults ).forEach( ( [ classID, parents ] ) => {
        //Add root level member and initialized members. Necessary for suggestions.
        if( targetHierarchy[classID] || !parents.parents.length ) {
            targetHierarchy[classID] = { parentID: targetHierarchy[classID], depth: parents.parents.length + 1 };
        }
    } );
    return childVMNodes;
}

/**
 * convertToVMNodes - Converts an array of childNodes to an array of ViewModelTreeNodes.
 * childNode array can be obtained from classifyService.getChildren when passing a findInfo3 response.classChildren.
 *
 * @param {Array<ChildNode>} rootNodes Nodes formatted in the shape of the those returned from classifyService.getChildren
 * @param {Object} treeLoadInput Tree load input. Input that is given from the data provider of the tree
 * @param {String} parentID The Class ID of the parent node
 * @returns {Array<ViewModeTreeNode>} The array of node that have been converted to tree nodes
 */
export function convertToVMNodes( rootNodes, treeLoadInput, parentID ) {
    let tempCursorObject = {
        endReached: true,
        startReached: true
    };
    let rootVMNodes = [];
    rootNodes.forEach( ( node, index ) => {
        if( node.typeIconFileUrl && !node.thumbnailUrl ) {
            node.thumbnailUrl = node.typeIconFileUrl;
        }
        let vmNode = awTableSvc.createViewModelTreeNode(
            node.id,
            node.type,
            node.className,
            treeLoadInput.parentNode.levelNdx + 1,
            index,
            node.thumbnailUrl ? node.thumbnailUrl : ''
        );

        vmNode.parent_Id = parentID ? parentID : treeLoadInput.parentNode.id;
        vmNode.childCount = node.childCount;
        vmNode.isLeaf = node.childCount === 0;
        vmNode.props = vmNode.props ? vmNode.props : [];
        vmNode.cursorObject = tempCursorObject;

        //in case of suggested classifications.
        if( node.classProbability ) {
            vmNode.props.classProbability = node.classProbability;
        }
        if( !node.childCount && node.children ) {
            vmNode.childCount = node.children.length;
            vmNode.children = node.children;
        }
        let vmProperty = uwPropertyService.createViewModelProperty( 'ClassName', 'ClassName', 'STRING', '', '' );
        vmNode.props.ClassName = vmProperty;
        rootVMNodes.push( vmNode );
    } );
    return rootVMNodes;
}


/**
 * Determines the child assignments for generated nodes to be added to a tree.
 *
 * @param {*} response response
 * @param {*} vmNode the current vmNode being created.
 * @param {*} mappedArr the array of nodes being constructed.
 * @param {*} id the id to extract child nodes for.
 */
function vmNodeChildrenAssignment( response, vmNode, mappedArr, id ) {
    if( response.classChildren ) {
        if( response.classChildren[id] && response.classChildren[id].children.length === 0 ) {
            vmNode.childCount = 0;
            vmNode.isLeaf = true;
        } else if ( response.classChildren[id] && !mappedArr[id].children && response.classChildren[id].children.length ) {
            mappedArr[id].children = response.classChildren[id].children;
        }
    }
}

/**
 * Process search response
 *
 * @param {*} deferred promise
 * @param {*} response response
 * @param {*} data data
 * @param {*} treeLoadInput tree load input
 * @param {object} releasesState Releases state containing releases information
 * @returns {Object} treeLoadResult
 */
function processSearchResponse( deferred, response, data, treeLoadInput, releasesState ) {
    var tempCursorObject = {
        endReached: true,
        startReached: true
    };

    if ( !response.clsClassDescriptors || !response.classParents ) {
        return processRejectedResponse( deferred, data, treeLoadInput, tempCursorObject );
    }

    var parentResults = response.classParents;
    var outputs = response.clsClassDescriptors;

    let mappedArr = prepareNodeDataForTree( outputs, parentResults, releasesState );

    var mappedElem;
    var vmNode = null;
    var finalTree = [];

    // Determine what is a root and what is a child
    for ( var id in mappedArr ) {
        mappedElem = mappedArr[id];

        // If the element is not at the root level, add it to its parent array of children.
        if ( mappedElem.parentid !== 'SAM' ) {
            vmNode = createVmNode( mappedElem, mappedElem.typeIconFileUrl, mappedArr[mappedElem.parentid].children.length );
            vmNodeChildrenAssignment( response, vmNode, mappedArr, id );
            vmNode.cursorObject = tempCursorObject;
            mappedArr[mappedElem.parentid].children.push( vmNode );
        } else {
            // If the element is at the root level, add it to first level elements array.
            vmNode = createVmNode( mappedElem, mappedElem.typeIconFileUrl, length );
            vmNodeChildrenAssignment( response, vmNode, mappedArr, id );
            vmNode.cursorObject = tempCursorObject;
            finalTree.push( vmNode );
        }
        if ( response.clsClassDescriptors && response.clsClassDescriptors[id] && response.clsClassDescriptors[id].childCount ) {
            vmNode.childCount = response.clsClassDescriptors[id].childCount;
            if( mappedArr[id].children.length === 0 ) {
                for( var i = 0; i < vmNode.childCount; i++ ) {
                    mappedArr[id].childCount = vmNode.childCount;
                }
            }
            vmNode.isLeaf = false;
        }
    }

    // When perform a filter for traditional classification we get siblings of ICM. This is an issue on the server and a
    // Story for next release is being made to fix this issue correctly. For now however we will filter out classes that are not 'ICM'
    finalTree = finalTree.filter( ( elem ) => { return elem.id === classifyDefinesService.CLASSIFICATION_ICM; } );
    var finalVMTNodes = [];
    // Processing that determines what is a leaf node or not.
    var stack = [];
    stack.push( finalTree[0] );
    while ( stack.length > 0 ) {
        vmNode = stack.pop();

        if ( vmNode.id !== 'ICM' ) {
            if ( vmNode.children.length === 0 ) {
                if ( outputs[vmNode.id] && outputs[vmNode.id].childCount === 0 ) {
                    vmNode.childCount = outputs[vmNode.id].childCount;
                    vmNode.isLeaf = true;
                }
                vmNode.isExpanded = false;
            }
            finalVMTNodes.push( vmNode );
        }

        for ( var i = 0; i < vmNode.children.length; i++ ) {
            stack.push( vmNode.children[i] );
        }
    }

    var isTopNode = data.treeLoadInput.parentNode.levelNdx === -1;
    var rootPathNodes = [];
    var treeLoadResult = null;
    if ( isTopNode ) {
        var vmNode1 = awTableSvc.createViewModelTreeNode(
            data.treeLoadInput.parentNode.id, '',
            data.treeLoadInput.parentNode.className, -1, 0, null );

        vmNode1.type = data.treeLoadInput.parentNode.type;

        rootPathNodes.push( vmNode1 );
        data.rootNode = treeLoadInput;

        // This is for loading search VNCs
        eventBus.publish( data.providerName + '.firstLevelSearchResultsLoaded', {
            response: response
        } );
    }
    treeLoadResult = awTableSvc.buildTreeLoadResult(
        data.treeLoadInput, finalVMTNodes, false, true, true, null );
    treeLoadResult.rootPathNodes = rootPathNodes;
    treeLoadResult.cursorObject = tempCursorObject;
    treeLoadResult.childNodes['0'].cursorObject = tempCursorObject;
    awTableStateService.clearAllStates( data, 'clsTreeTable' );
    data.numOfResults = finalVMTNodes.length;

    var vncDisplay = [];
    for( let searchResult of Object.keys( outputs ) ) {
        vncDisplay.push( mappedArr[searchResult] );
    }
    vncDisplay.reverse();

    deferred.resolve( {
        treeLoadResult: treeLoadResult,
        searchResults: vncDisplay
    } );
}
/**
 * This function is responsible for publishing the final tree that has been constructed and passed in. Once finished it will resolve the deferred promise that has been passed in.
 *
 * @param {Object} data The viewModel data object from Awp0ClassificationTreeViewModel.json
 * @param {Object} treeLoadInput Tree load input. Input that is given from the data provider of the tree
 * @param {Object} response The findInfo3 response object. This is passed to the VNC so that they can display if needed
 * @param {Array<ViewModelTreeNode>} finalVMTNodes The array of the ViewModelTreeNodes that will be displayed in the classification hierarchy tree table
 * @param {Object} cursorObject (Optional) The cursor object that lets the tree know if we have finished expanding. Defaults to `{ endReached: true, startReached: true }`
 * @param {Promise} deferred The deferred promise that will be resolved with the final tree
 */
function publishTree( data, treeLoadInput, response, finalVMTNodes, cursorObject, deferred ) {
    cursorObject = cursorObject ? cursorObject : { endReached: true, startReached: true };

    var isTopNode = data.treeLoadInput.parentNode.levelNdx === -1;
    var rootPathNodes = [];
    var treeLoadResult = null;
    if ( isTopNode ) {
        var vmNode1 = awTableSvc.createViewModelTreeNode(
            data.treeLoadInput.parentNode.id, '',
            data.treeLoadInput.parentNode.className, -1, 0, null );

        vmNode1.type = data.treeLoadInput.parentNode.type;

        rootPathNodes.push( vmNode1 );
        data.rootNode = treeLoadInput;

        // This is for loading search VNCs
        eventBus.publish( data.providerName + '.firstLevelSearchResultsLoaded', {
            response: response
        } );
    }

    treeLoadResult = awTableSvc.buildTreeLoadResult(
        data.treeLoadInput, finalVMTNodes, false, true, true, null );

    treeLoadResult.rootPathNodes = rootPathNodes;
    treeLoadResult.cursorObject = cursorObject;
    treeLoadResult.childNodes['0'].cursorObject = cursorObject;

    awTableStateService.clearAllStates( data, 'clsTreeTable' );

    data.numOfResults = finalVMTNodes.length;

    deferred.resolve( {
        treeLoadResult: treeLoadResult
    } );
}

/**
 * Process default response
 *
 * @param {*} outputs outputs
 * @param {*} parentResults parentResults
 * @param {*} releasesState releasesState
 * @param {*} treeLoadInput tree load input
 * @returns {Object} mappedArr
 */
function prepareNodeDataForTree( outputs, parentResults, releasesState ) {
    let parentId;
    let type;
    let mappedArr = {};

    // Set temporary hierarchy root to handle eclass hierarchy
    _.forEach( parentResults, function( node ) {
        var parentList = node.parents;
        if ( parentList.length === 0 || parentList[parentList.length - 1].properties[0].values[0].displayValue !== 'SAM' ) {
            addTemporaryRootToHierarchy( parentList );
        }
    } );

    _.forEach( outputs, function( output ) {
        var id = classifyUtils.getPropertyValueFromArray( output.properties, classifyService.UNCT_CLASS_ID );
        parentId = classifyUtils.getPropertyValueFromArray( parentResults[id].parents['0'].properties, classifyService.UNCT_CLASS_ID );
        type = classifyUtils.getPropertyValueFromArray( output.properties, classifyService.UNCT_CLASS_TYPE );
        buildNode( mappedArr, output, parentId, type, parentResults[id].parents.length, releasesState );
    } );

    _.forEach( parentResults, function( node ) {
        var parentList = node.parents;
        for ( var i = parentList.length - 2; i >= 0; i-- ) {
            parentId = classifyUtils.getPropertyValueFromArray( parentList[i + 1].properties, classifyService.UNCT_CLASS_ID );
            type = classifyUtils.getPropertyValueFromArray( parentList[i + 1].properties, classifyService.UNCT_CLASS_TYPE );
            buildNode( mappedArr, parentList[i], parentId, type, parentList.length - 1 - i, releasesState );
        }
    } );

    return mappedArr;
}

/**
 * Process default response
 * @param {*} deferred promise
 * @param {*} response response
 * @param {*} data data
 * @param {*} treeLoadInput tree load input
 * @param {*} searchCriteria search criteria
 */
function processDefaultResponse( deferred, response, data, treeLoadInput, searchCriteria ) {
    var tempCursorObject = {
        endReached: true,
        startReached: true
    };
    if ( response && response.classChildren && _.has( response, 'classChildren.Cls0DefaultView' ) ) {
        data.doNotLoad = true;
    }

    var children1 = [];
    var children = classifyService.getChildren( response, true, [ searchCriteria.searchString, 'Cls0DefaultView' ] );
    var currentLevel = children;
    var parents = [];

    if ( treeLoadInput.parentNode.id === classifyDefinesService.ROOT_LEVEL_ID ) {
        data.currentLevel = currentLevel;
        data.initialHierarchy = currentLevel;
        data.parents = parents;

        // This is for loading AI Suggestions
        data.tileClick = function( node ) {
            data.suggestedRight = data.suggestedRibbonIncr * 21 + '%';
            data.selectedNode = node;
            eventBus.publish( 'navigateToSuggestedClassEvent', data );
        };
        data.treeInTab = data.treeInTab || {};
        data.treeInTab.firstLevelResponse = response;
        eventBus.publish( data.providerName + '.firstLevelTreeLoaded' );

        data.initialHierarchy.isSecondLevelLoaded = true;
        getNextLevelChildrenForTree( data, data.providerName );
    }
    for ( var i = 0; i < children.length; i++ ) {
        var vmNode = awTableSvc.createViewModelTreeNode(
            children[i].id, '',
            children[i].className, treeLoadInput.parentNode.levelNdx + 1, i,
            '' );
        if ( children[i].childCount === 0 ) {
            vmNode.childCount = children[i].childCount;
            vmNode.isLeaf = true;
        } else {
            vmNode._twistieTitle = classifyDefinesService.SHOW_CHILDREN;
            vmNode.isLeaf = false;
        }

        if ( children[i].thumbnailUrl ) {
            vmNode.iconURL = children[i].thumbnailUrl;
        }

        vmNode.parent_Id = treeLoadInput.parentNode.id;
        vmNode.type = children[i].type;

        vmNode.parentDisplayName = treeLoadInput.parentNode.displayName;
        if ( !vmNode.props ) {
            vmNode.props = [];
        }
        var vmProperty = uwPropertyService.createViewModelProperty( 'ClassName', 'ClassName', 'STRING', '', '' );
        vmNode.props.ClassName = vmProperty;

        children1.push( vmNode );
    }

    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    var rootPathNodes = [];
    if ( isTopNode ) {
        var vmNode1 = awTableSvc.createViewModelTreeNode(
            treeLoadInput.parentNode.id, '',
            treeLoadInput.parentNode.className, -1, 0, null );

        vmNode1.type = treeLoadInput.parentNode.type;

        rootPathNodes.push( vmNode1 );
        data.rootNode = treeLoadInput;
    }

    var treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, children1, false, true, true, null );

    treeLoadResult.rootPathNodes = rootPathNodes;

    treeLoadResult.parentNode.cursorObject = tempCursorObject;

    awTableStateService.clearAllStates( data, 'clsTreeTable' );

    deferred.resolve( {
        treeLoadResult: treeLoadResult,
        clsClassDescriptors: response.clsClassDescriptors ? response.clsClassDescriptors : undefined // for suggestions.
    } );
}

/**
 * Private function
 * Calls SOA and handles the response
 * @param {Object} deferred deferred input
 * @param {Object} treeLoadInput Tree load input
 * @param {Object} data The view model data object
 * @param {Object} searchString String search input
 * @param {String} releasesState Releases state containing releases information
 * @param {Object} classifyState Struct containing classify tab related information
 * @param {Object} sortOption sortOption
 * @param {Object} siblingsResponse Struct containing the response of the sibling SOA - Optional
 * @param {Object} processSiblingResponse Struct containing the response from the sibling SOA call - Optional.
 * @param {Object} siblingParentHierarchy Struct containing the parent Hierarchy - Optional.
 * @param {String} workspaceObjUid If there is a particular selected workspace object.
 */
function buildTreeTableStructure( deferred, treeLoadInput, data, searchString, releasesState, classifyState,
    sortOption,  siblingsResponse, processSiblingResponse, siblingParentHierarchy, workspaceObjUid  ) {
    data.numOfResults = null;
    if( siblingsResponse && processSiblingResponse && siblingsResponse.classParents ) {
        buildTreeForExpandToTargetClass( deferred, siblingsResponse, data, treeLoadInput, siblingParentHierarchy );
    } else if( !processSiblingResponse ) {
        var requestInfo = buildSearchInput( treeLoadInput, data, searchString, releasesState, classifyState, sortOption, workspaceObjUid );
        soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, requestInfo.request ).then( function( response ) {
            if ( requestInfo.defaultSearch ) {
                processDefaultResponse( deferred, response, data, treeLoadInput, requestInfo.searchCriteria );
            } else {
                if( classifyState ) {
                    response.reset = true;
                    clsTreeSyncUtils.resetSelectedToDefault( response, classifyState, searchString );
                }
                processSearchResponse( deferred, response, data, treeLoadInput, releasesState );
            }
        } );
    }
}


/* ----------------------------- TABLE PROPERTIES/COLUMN RELATED -------------------------------------------- */
/**
 * Load properties to be shown in the tree structure
 * @param {object} dataProvider The view model data object
 * @param {object} propertyLoadInput The view model data object
 * @return {object} Output of loadTableProperties
 */
export let loadPropertiesJS = function (dataProvider, propertyLoadInput) { // eslint-disable-line
    var viewModelCollection = dataProvider.getViewModelCollection();
    var loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    /**
     * Extract action parameters from the arguments to this function.
     */
    propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if ( propertyLoadInput !== null &&
        propertyLoadInput !== undefined &&
        propertyLoadInput !== 'undefined' ) {
        return exports.loadTableProperties( propertyLoadInput, loadedVMOs );
    }
};

/**
 * load Properties required to show in tables'
 * @param {Object} propertyLoadInput - Property Load Input
 * @param {Array} loadedVMOs - Loaded View Model Objects
 * @return {Object} propertyLoadResult
 */
export let loadTableProperties = function( propertyLoadInput /* , loadedVMOs */ ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if ( !childNode.props ) {
                childNode.props = {};
            }

            if ( childNode.id !== classifyDefinesService.ROOT_LEVEL_ID ) {
                allChildNodes.push( childNode );
            }
        } );
    } );

    var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};

/**
 * Loads columns for the column
 * @return {object} promise for async call
 */
export let loadColumns = function( ) {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [];

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'ClassName',
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
 * Loads the first level children to display on VNC
 *
 * @param {object} data - The declarative view model
 * @param {object} providerName - Name of the data provider
 * @param {object} selectedNode - Selected Node
 * @returns {Promise} Promise that will be resolved when all the first level and next level VNCs are loaded.
 */
let getFirstLevelChildrenForTree = function( data, providerName, selectedNode ) {
    var clssId = null;
    if ( selectedNode === null ) {
        clssId = 'ICM';
    } else {
        clssId = selectedNode.id;
    }

    var searchCriteria = {};
    searchCriteria.searchAttribute = classifyService.UNCT_CLASS_ID;
    searchCriteria.searchString = clssId;
    searchCriteria.sortOption = classifyService.UNCT_SORT_OPTION_CLASS_ID;

    var soaPromise;
    if ( selectedNode ) {
        soaPromise = new Promise( function( resolve ) {
            AwTimeoutService.instance( () => {
                data.currentLevel = {
                    children: []
                };
                resolve();
            }, 0 );
        } );
        var context = {
            selectedNode: data.selectedNode
        };
        eventBus.publish( providerName + '.selectStorageNode', context );
    }
    /**
     * Common code which is to be called after first level VNC is loaded
     * @Returns {Promise} Returns a promise returned by nextLevelChildrenForTree
     */
    function firstLevelLoadCompleted() {
        return getNextLevelChildrenForTree( data, providerName );
    }
    return soaPromise.then( ( ) => firstLevelLoadCompleted() );
};

/**
 * Node > parent > child
 * selected node can contain two levels information,
 * Add new parameter isVNCaction
 * Drill down to the next level of the selectedNode.
 * @param {Object} data The declarative viewModel data
 * @param {String} providerName The name of the data provider
 * @returns {*} null or the selectedNode
 */
export let drillToNextLevel = function( data, providerName ) {
    // If tree node is selected
    if ( data.dataProviders && data.dataProviders[providerName].selectedObjects !== undefined && data.dataProviders[providerName].selectedObjects[0] ) {
        data.selectedNode = data.dataProviders[providerName].selectedObjects[0];

        if ( data.selectedNode !== null ) {
            data.currentLevel = { children: [] };
            // This means there is a selected node which does not have child nodes.
            data.isClsSearchButtonVisible = true;
            getFirstLevelChildrenForTree( data, providerName, data.selectedNode );
        }
        return data.selectedNode;
    }
    return null;
};

/**
 * Following method keeps counter for expansion, which decides no. of times tree node expansion should happen
 * @param {*} data Declarative view model
 * @param {String} providerName the name of the dataProvider
 * @returns {bool} false
 */
export let parseExpansion = function( data, providerName ) {
    if ( data.expansionCounter > 0 ) {
        var vmNode = awTableSvc.createViewModelTreeNode(
            data.selectedNode.id, '',
            data.selectedNode.className, 0, 0,
            '' );

        if ( data.selectedNode.childCount === 0 ) {
            vmNode.isLeaf = true;
        } else {
            vmNode.isLeaf = false;
        }
        vmNode.childCount = data.selectedNode.childCount;
        vmNode.type = data.selectedNode.type;
        data.dataProviders[providerName].selectionModel.setSelection( vmNode );

        return data.expansionCounter;
    }

    return 0;
};

/**
 * Perform search based on selected class in location
 *
 * @param {*} data ViewModel Data Containing 'isNavigating' and 'eventData'.
 * @param {*} context subPanel context containing 'searchState.value'
 * @param {Object} classifyState the state of the classification panel
 * @returns {Object} selectedNode
 */
export let searchClass = function( data, context, classifyState ) {
    data.isNavigating = true;
    //tree node is being selected, lets do class search
    var classid = data.eventData.selectedNode.id;
    if( context.selectionData && context.selectionData.value.selectedClassNode ) {
        classid = context.selectionData.value.selectedClassNode.uid;
    }
    var str = '"Classification Class Id":' + '"' + classid + '"';

    if ( !classifyState && context ) {
        const tmpContext = { ...context.searchState.value };
        tmpContext.criteria.searchString = str;
        tmpContext.searchFilterMap = {};
        if( tmpContext.standAlone && tmpContext.standAlone === true ) {
            tmpContext.standAlone = false;
        }
        if( !context.searchState.selectedNode ) {
            tmpContext.selectedNode = data.eventData.selectedNode;
        }
        if( tmpContext.criteria.searchString !== context.searchState.value.criteria.searchString
            || tmpContext.searchFilterMap !== context.searchState.value.searchFilterMap
            || tmpContext.selectedNode !== context.searchState.value.selectedNode
            || context.searchState.value.standAlone ) {
            context.searchState.update( tmpContext );
        }
        if( context.selectionData ) {
            updateSelectedClassNode( data.eventData.selectedNode, context.selectionData );
        } else {
            updateSelectedClassNode( data.eventData.selectedNode, context );
        }
    }
    return data.eventData.selectedNode;
};

/**
 *  Updates node state
 * @param {*} data - viewModel data object. Not sure where this is used but the data optional is not used
 * @param {*} searchState - the state of search
 * @param {*} classifyState - the object that represents classify state.
 * @param {*} selectedNode - selected node object
 */
export let updateNodeData = function( data, searchState, classifyState, selectedNode ) {
    let isPanel = classifyState && classifyState.value.isClassifyPanel;
    if ( searchState && !isPanel ) {
        const tmpState = { ...searchState.value };
        tmpState.selectedNode = selectedNode;
        searchState.update( tmpState );
    }
    // // In case of edit class do not update selected node.
    // // Maybe duplicated code. Please see updateSelectedClassNode inside of updateTreeSelection.
    if ( classifyState && classifyState.editClassCmd && ( classifyState.editClassCmd.targetClassID !== selectedNode.uid || classifyState.editClassCmd.alreadySelectedClassNode ) ) {
        const tmpState1 = { ...classifyState.value };
        tmpState1.selectedNode = selectedNode;
        classifyState.update( tmpState1 );
    }
};

/**
 * Take the parentClasses from a findInfo3 call and formats them into a the searchCriteria for findInfo3
 *
 * @param {Object} parentClasses - classParent part of findInfo3 SOA call
 * @param {String} targetClass - the class we expanding to... not needed for next generation classification
 * @returns {Array<SOASearchCriteria>} the search criteria for the next findInfo3 call
 */
export function buildSOASearchCriterias( parentClasses, targetClass ) {
    let body = [];
    let targetHierarchy = {};

    Object.entries( parentClasses ).forEach( ( [ targetClass, classDefs ] ) => {
        targetHierarchy[targetClass] = '';
        let previousClass = '';
        classDefs.parents.forEach( ( parent ) => {
            let classIDProperty = parent.properties.find( property => {
                return property.propertyId === classifyDefinesService.CLASS_ID_PROPERTY;
            } );

            if ( !previousClass ) {
                targetHierarchy[targetClass] = classIDProperty.values[0].internalValue;
            } else {
                targetHierarchy[previousClass] = classIDProperty.values[0].internalValue;
            }

            previousClass = classIDProperty.values[0].internalValue;

            body.push( buildSearchCriteria( classIDProperty.values[0].internalValue ) );
        } );
    } );

    let rootICM = body.find( ( criteria ) => { return criteria.searchString === classifyDefinesService.CLASSIFICATION_ICM; } );

    body.push( buildSearchCriteria( rootICM ? targetClass : classifyDefinesService.CLASSIFICATION_ICM ) );

    return { body, targetHierarchy };
}

/**
 *
 * @param {String} searchString - The search string to send to the SOA
 * @returns {Object} searchCriteria
 */
function buildSearchCriteria( searchString ) {
    return {
        searchAttribute: classifyDefinesService.CLASS_ID_PROPERTY,
        searchString: searchString,
        sortOption: classifyDefinesService.LOAD_CLASS_ROOTS
    };
}

/**
 * Use the uid of a selected class to construct criteria to fetch related classes.
 *
 * @param {Object} syncUid - uid to build search string from.
 * @returns {Array<SOASearchCriteria>} the search criteria for the next findInfo3 call
 */
export let buildSOASearchCriteriasNavPanel = ( syncUid ) => {
    let navPanelDrillCriteria = [];
    navPanelDrillCriteria.push( buildSearchCriteria( syncUid ) );
    return navPanelDrillCriteria;
};

/**
 *  Decouples the search info added by searchClass from the uid of the node.
 * @param {String} searchStr the search string used in search state containing the uid.
 * @return {String} decoupled string.
 */
export let decoupleSearchEncoding = function( searchStr ) {
    return searchStr.slice( 0, -1 ).replace( '"Classification Class Id":"', '' );
};

/**
 *
 * @param {Object} siblingsResponse - The findInfo3 response
 * @param {Object} data - data object from Awp0ClassificationTreeViewModel
 * @param {Object} treeLoadInput - Tree load input. Input that is given from the data provider of the tree
 * @param {Object} releasesState - Struct containing releases information
 * @returns {Object} treeLoadResponse
 */
export function buildTree( siblingsResponse, data, treeLoadInput, releasesState ) {
    let deferred = AwPromiseService.instance.defer();
    return processSearchResponse( deferred, siblingsResponse, data, treeLoadInput, releasesState );
}

export let selectEditClass = ( classifyState, vmCollection ) => {
    if( classifyState && !classifyState.editClassCmd.alreadySelectedClassNode && classifyState.value.editClassUID !== classifyDefinesService.NULL_UID && vmCollection.totalObjectsLoaded > 0 ) {
        let tempSelectedNode = findSelectedObject( vmCollection, classifyState.value.editClassCmd.targetClassID );
        let newClassifyState = { ...classifyState.value };
        let newEditClassCmd = { ...newClassifyState.editClassCmd };

        newClassifyState.selectedNode =  tempSelectedNode;
        newEditClassCmd.alreadySelectedClassNode = true;
        newClassifyState.expandToClass = '';
        newClassifyState.editClassCmd = newEditClassCmd;
        delete newClassifyState.selectedSuggestion;

        classifyState.update( newClassifyState );
    }
};

/**
 *
 * @param {State} classifyState the classify state to update with the selected class node.
 */

export let processSuggestedClassIco = function( classifyState ) {
    let tempClsState = { ...classifyState.value };
    if( tempClsState.suggestedClassIcoUID ) {
        tempClsState.editClassUID = tempClsState.suggestedClassIcoUID;
        delete tempClsState.suggestedClassIcoUID;
        classifyState.update( tempClsState );
    }
};

/**
 *  Syncs the tree table with a given node. Creates a fake node object and then sets that as the external selection.
 * @param {String} nodeUid the uid of the node to select.
 * @param {ViewModelObjectCollection} vmCollection the view model collection of the table
 * @param {SelectionModel} selectionModel selection model of panel
 * @return {String} new nav panel drill criteria.
 */
export let syncPanel = function( nodeUid, vmCollection, selectionModel ) {
    const selectedNode = findSelectedObject( vmCollection, nodeUid );
    const updateDrill = makeTreeSelection( selectedNode, selectionModel );
    if( updateDrill ) {
        return '';
    }
};

/**
 *  Makes a selection on the tree and applies appropriate actions to it. Only usable if you have a node already on the table.
 * TODO: Update updateExternalSelection with this refactored code.
 * @param {ViewModelTreeNode} selectedNode the node to set the selection to.
 * @param {SelectionModel} selectionModel selection model of panel
 */
export let makeTreeSelection = function( selectedNode, selectionModel ) {
    //If the object has not been properly selected yet, select it.
    const currentSelection = selectionModel.selectionData.value.selected;
    if( selectedNode && !selectedNode.selected && ( !currentSelection || !currentSelection.length ) || currentSelection && selectedNode && currentSelection[0].uid !== selectedNode.uid ) {
        selectionModel.setSelection( selectedNode );
        if ( selectedNode._twistieTitle === classifyDefinesService.SHOW_CHILDREN ) {
            selectedNode.isExpanded = true;
            eventBus.publish( 'clsTreeTable.plTable.toggleTreeNode', selectedNode );
        }
        return true;
    }
};

/**
 *  Note: Check if this needed
 * Search for the loaded tree nodes for the given class id.
 * @param {Object} data The declarative viewmodel data
 * @param {String} providerName provider name
 * @param {String} classId Class id to be searched
 * @returns {Object} If tree node exists with that class id, return the tree node, else returns null
 */
export let getTreeNodeFromClassId = function( data, providerName, classId ) {
    var index = 0;
    for ( ; index < data.dataProviders[providerName].viewModelCollection.loadedVMObjects.length; index++ ) {
        var node = data.dataProviders[providerName].viewModelCollection.loadedVMObjects[index];
        if ( node.id === classId ) {
            break;
        }
    }
    if ( index !== data.dataProviders[providerName].viewModelCollection.loadedVMObjects.length ) {
        return data.dataProviders[providerName].viewModelCollection.loadedVMObjects[index];
    }
    return null;
};

/**
 * Note: Check if this needed
 * Checks if the children exists in the parent tree node.
 * Usage: This function is used to check if the child node is to be added to VNCs in case of class search
 * @param {Object} parentTreeNode Parent tree node
 * @param {String} childClassId Child class id which is to be checked in the parent tree node's children
 * @returns {Boolean} False if the tree node expanded and child class Id does not exists. True otherwise
 */
export let checkIfChildClassToBeAddedToVNC = function( parentTreeNode, childClassId ) {
    if ( typeof parentTreeNode === 'object' && parentTreeNode !== null && parentTreeNode.isExpanded && parentTreeNode.children ) {
        // Checking for existence of the childClassId in the parentTreeNode
        var index = 0;
        for ( ; index < parentTreeNode.children.length; index++ ) {
            if ( parentTreeNode.children[index].id === childClassId ) {
                return true;
            }
        }
        return false;
    }
    return true;
};

export default exports = {
    buildSOASearchCriterias,
    buildSOASearchCriteriasNavPanel,
    buildTree,
    checkIfChildClassToBeAddedToVNC,
    convertToVMNodes,
    decoupleSearchEncoding,
    drillToNextLevel,
    getClassificationDataOptions,
    getTreeNodeFromClassId,
    getTreeStructure,
    getTreeStructureTableForExpand,
    loadColumns,
    loadPropertiesJS,
    loadTableProperties,
    parseExpansion,
    processSuggestedClassIco,
    searchClass,
    selectEditClass,
    syncPanel,
    updateExternalSelection,
    updateNodeData,
    updateSelectedClassNode,
    updateTreeSelection
};
