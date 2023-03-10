// Copyright (c) 2022 Siemens

/**
 * Service to create Object
 *
 * @module js/ssp0CreateObjectService
 */

import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import soaService from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';

let exports = {};

const RESOURCE_MESSAGE = 'ServicePlannerConstants';

const messagesMap = new Map();
messagesMap.set( servicePlannerConstants.TYPE_WORK_CARD, servicePlannerConstants.MSG_WC_CREATED );
messagesMap.set( servicePlannerConstants.TYPE_SERVICE_CONTAINER, servicePlannerConstants.MSG_SC_CREATED );
messagesMap.set( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT, servicePlannerConstants.MSG_SR_CREATED );

let _addRelatedObjects = function( body, selectedVMO ) {
    if ( body.saveInput ) {
        if ( body.saveInput.relatedObjects === undefined ) {
            body.saveInput.relatedObjects = {};
        }
        body.saveInput.relatedObjects[selectedVMO.uid] = {
            uid: selectedVMO.uid,
            type: selectedVMO.type
        };
    }
};

let _initSectionInput = function( sectionName, sectionOject ) {
    return {
        saveInput: {
            sections: [
                {
                    sectionName: sectionName,
                    dataEntries: [
                        {
                            entry: {
                                Object: {
                                    nameToValuesMap: sectionOject
                                }
                            }
                        }
                    ]
                }
            ]
        }
    };
};

let _addEntries = function( input, entryName, data ) {
    if ( data ) {
        input[entryName] = {};
        input[entryName].nameToValuesMap = data;
    }
};

/**
 * create Input Object for the SOA
 * @param {Object} data data
 * @param {String} createType createType
 * @return {Object} result of the SOA
 */
export let getCreateInput = function( data, createType ) {
    const getCreateInput = addObjectUtils.getCreateInput( data, '', createType );
    let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
    if ( selectedVMO.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_PLAN_PROCESS ) ) {
        let tempSelectedVMO = {};
        tempSelectedVMO.uid = selectedVMO.servicePartitionUid;
        tempSelectedVMO.type = servicePlannerConstants.TYPE_SERVICE_PARTITION_PROCESS;
        selectedVMO = tempSelectedVMO;
    }
    const itemPropertyNamesValues = getCreateInput[0].createData.propertyNameValues;
    const revPropertyNamesValues = getCreateInput[0].createData.compoundCreateInput.revision[0].propertyNameValues;
    const nameToValuesMap = {
        Type: [
            createType
        ],
        connectTo: [
            selectedVMO.uid
        ]
    };
    let body = _initSectionInput( 'ObjectsToCreate', nameToValuesMap );

    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    // add item props
    _addEntries( entryAnchor, 'ItemProps', itemPropertyNamesValues );
    // add revision props
    _addEntries( entryAnchor, 'RevProps', revPropertyNamesValues );

    _addRelatedObjects( body, selectedVMO );

    return soaService.postUnchecked('Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body).then(function (result) {
        if (result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues) {
            msgSvc.showError(result.ServiceData.partialErrors[0].errorValues[0].message);
            return result;
        }
        let localTextBundle = localeService.getLoadedText(RESOURCE_MESSAGE);
        msgSvc.showInfo(localTextBundle[messagesMap.get(createType)]);
        let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
        let modelObjects = result.ServiceData.modelObjects;
        let childNodeUid = result.saveEvents.filter(element => element.eventType === 'create')[0].eventObjectUid;
        let childNode = getChildNode(modelObjects, childNodeUid);
        if(selectedVMO && selectedVMO.isExpanded){
            eventBus.publish('SSP0ServicePlanTree.newNodeAdded', {
                soaResult: result,
                childNodeUid: childNode.uid
            } );
        }else{
            eventBus.publish('expandSelectedNode', {
                nodeToBeExpanded: selectedVMO,
                nodeToBeSelected: childNode
            } );
        }
        return result;
    });
};

function newNodeAdded(result, dataProvider){
    let selectedVMO = appCtxService.getCtx( 'selectedVMO' );
    let childNode = getChildNode(result.modelObjects, result.plain[0]);
    const parentTreeNode = getTreeNode(dataProvider, selectedVMO);
    appendChildNodes(parentTreeNode, childNode, dataProvider);
}

function getChildNode (modelObjects, childNodeUid) {
    return Object.values( modelObjects ).filter( modelObject =>modelObject.uid === childNodeUid)[0];
}

/**
   * get Tree Node from dataProvider
   *
   * @param {Object} dataProvider - the save events as json object
   * @param {Object} modelObject - event Type
   *
   * @returns {Object} the tree node
   */
 function getTreeNode( dataProvider, modelObject ) {
    return modelObject && _.find( dataProvider.viewModelCollection.getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === modelObject.uid );
}

export function appendChildNodes( parentTreeNode, childObjects, dataProvider ) {
    if( !parentTreeNode.children ) {
        parentTreeNode.children = [];
    }
    parentTreeNode.isLeaf = false;
    const childIndex = parentTreeNode.children.length;
    let childNdx = childIndex;
    const childTreeNodes =  getTreeNodeObject( childObjects, parentTreeNode, true, childNdx++ );
    const loadedVmos = [ ...dataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let refIndex = loadedVmos.indexOf( parentTreeNode );
    const descendantTreeNodes = getAllDescendantTreeNodes( parentTreeNode );
    descendantTreeNodes.forEach( descendant => {
        let index = loadedVmos.indexOf( descendant );
        if( index > refIndex ) {
            refIndex = index;
        }
    } );
    loadedVmos.splice( refIndex + 1, 0, childTreeNodes );
    parentTreeNode.children.splice( childIndex, 0, childTreeNodes );

    dataProvider.update( loadedVmos, loadedVmos.length );
    setSelectionOfAddedNode(dataProvider, childTreeNodes);
}

function setSelectionOfAddedNode(dataProvider, nodeToSelect) {
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    const loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToSelect.uid );
    dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
}

/**
 * Returns all of the decendant tree nodes
 * @param {ViewModelTreeNode} treeNode - a given tree node object
 * @return {ViewModelTreeNode[]} array of tree node objects
 */
 export function getAllDescendantTreeNodes( treeNode ) {
    const descendants = [];
    if( !treeNode.isLeaf && treeNode.children && treeNode.children.length > 0 ) {
        treeNode.children.forEach( ( childTreeNode ) => {
            descendants.push( ...getAllDescendantTreeNodes( childTreeNode ) );
        } );
        descendants.push( ...treeNode.children );
    }
    return descendants;
}

/**
 * getTreeNodeObject
 *
 * @param {Object} nodeObject - model object or view model object
 * @param {Object} parentNode - the parent node
 * @param {boolean} isLeaf - check if node has further children
 * @param {int} childNdx - child index
 *
 * @return {Object} vmNode - tree node object
 */
 export function getTreeNodeObject( nodeObject, parentNode, isLeaf, childNdx, displayNameProp = "object_string" ) {
    if( !viewModelObjectService.isViewModelObject( nodeObject ) ) {
        nodeObject = viewModelObjectService.createViewModelObject( nodeObject );
    }
    let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( nodeObject, 'create' );
    if ( nodeObject.props.bl_item_object_name ) {
        vmo.displayName = nodeObject.props.bl_item_object_name.dbValues[0];
        vmo.levelNdx = parentNode.levelNdx + 1;
        vmo.underlyingObjectType = nodeObject.type;
        vmo.isVisible = false;
    }
    if ( nodeObject.props.bl_has_children ) {
        vmo.isLeaf = nodeObject.props.bl_has_children.dbValues[0] === '0';
    }
    vmo.alreadyExpanded = false;
    if( !vmo.props ) {
        vmo.props = nodeObject.props;
    }
    return vmo;
}

/**
 * create Input Object for set Occurrence Type
 * @param {Object} selectedVMO VMO selected in Parts View
 * @param {Object} occType Occurrence Type
 * @return {Object} result of the SOA
 */
export let createObjectOfSetOccType = function( selectedVMO, occType ) {
    let body = _initSectionInput( 'ObjectsToModify', {
        id: [
            selectedVMO.uid
        ]
    } );
    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    _addEntries( entryAnchor, 'Prop', {
        bl_occ_type: [
            occType
        ]
    } );

    const parentVMO = appCtxService.getCtx( 'selectedVMO' );
    _addRelatedObjects( body, selectedVMO );
    _addRelatedObjects( body, parentVMO );
    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body ).then( function( result ) {
        eventBus.publish( 'reloadPartsTree' );
        return result;
    } );
};

export default exports = {
    getCreateInput,
    createObjectOfSetOccType,
    newNodeAdded
};
