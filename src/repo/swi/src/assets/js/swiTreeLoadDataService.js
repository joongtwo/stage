// Copyright (c) 2022 Siemens

/**
 * @module js/swiTreeLoadDataService
 */

import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import viewModelObjectService from 'js/viewModelObjectService';
import { getBaseUrlPath } from 'app';
import eventBus from 'js/eventBus';
let exports = {};

/**
 *Sorts getProperties Output as per getServiceWorkInstructions SOA
 @param {Array} swiObjectPropertyList response fron getProperties SOA
 @param {Array} sortedObjectUids array of sorted uids
 @return {Array}  sorted Model Objects Array
 */
let swiObjectPropertyListToSequentialList = function (swiObjectPropertyList, sortedObjectUids) {
    let sortedModelObjectArray = [];
    for (let i = 0; i < sortedObjectUids.length; i++)
    {
        let swiPropObject;
        let uid = sortedObjectUids[i];
        for (let j = 0; j < swiObjectPropertyList.length; j++)
        {
            if (uid === swiObjectPropertyList[j].uid)
            {
                swiPropObject = swiObjectPropertyList[j];
            }
        }
                sortedModelObjectArray.push(swiPropObject);
    }
    return sortedModelObjectArray;
};
/**
 *Get icon path based on object type
 @param {object} vmo object node
 @return {String} image Path
 */
let getIconSourcePath = function (vmo) {
    let imagePath = getBaseUrlPath() + '/image/';
    let underlyingObjectType = cdm.getObject(vmo.props.swi1UnderlyingObject.dbValues[0]).modelType.typeHierarchyArray;
    if (underlyingObjectType.indexOf('MEActivity') > -1){ imagePath += 'typeTimeActivity48.svg';}
   else if (underlyingObjectType.indexOf('SSP0WorkCardRevision') > -1){ imagePath += 'typeWorkCardRevision48.svg';}
   else if (underlyingObjectType.indexOf('Smr0Warning') > -1)
   {
       let warningObj = cdm.getObject(vmo.props.swi1UnderlyingObject.dbValues[0]);
       if(warningObj.props.smr0warningType.dbValues[0]==="Smr0WarningValue" || warningObj.props.smr0warningType.dbValues[0]==="Smr0HazardousMaterial"){
        imagePath += 'typeWarning48.svg';
       }else if(warningObj.props.smr0warningType.dbValues[0]==="Smr0Caution")
       {
        imagePath += 'indicatorCaution16.svg';
       }
       else{
        imagePath += 'typeCustomNote48.svg';
       }
    }

    return imagePath;
};

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadServiceReqTreeTableColumns = function (data) {

    const localizeDisplayName = data.grids.serviceReqTreeTable.i18n;
    let awColumnInfos = [];
    let columnNames = [ 'swi1ObjectName', 'swi1ObjectDescription', 'swi1RequiredDuration' ];
    let displayNames = [ localizeDisplayName.nameValueColumn, localizeDisplayName.descriptionValueColumn, localizeDisplayName.reqDurationValueColumn ];

    for( let itr = 0; itr < columnNames.length; itr++ ) {
        let pinnedLeft = columnNames[itr]==="swi1ObjectName"?true:false;
        let isTreeNavigation = columnNames[itr]==="swi1ObjectName"?true:false;
        let displayname = displayNames[itr];
        awColumnInfos.push( {
            name: columnNames[itr],
            displayName: displayname,
            width: 300,
            enableColumnMenu: false,
            enableColumnMoving: false,
            pinnedLeft: pinnedLeft,
            isTreeNavigation: isTreeNavigation
        } );
    }

    return {
        columnConfig: {
            columns: awColumnInfos
        }
    };

};

/**
 * Get all the children for the node passed
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @param {Array} sortedModelObjs sorted swiItems List
 * @param {bool} isFirstCall defines if it is first time function call
 * @return {array} List of child nodes
 */
let getChildren = function (nodeBeingExpanded, sortedModelObjs, isFirstCall,swiAtomicData) {
    let children = [];
    let objectsToReturn = [];
    let swiItemLeafNodes=[];
    var swiContextUid = appCtxSvc.getCtx( 'swiContext.uid' );
    for (let i = 0; i < sortedModelObjs.length; i++) {
        if (isFirstCall === true) {
            let vmo = viewModelObjectService.constructViewModelObjectFromModelObject(sortedModelObjs[i], 'create');
                if (vmo.props.swi1Parent.dbValues[0] ===swiContextUid){
                vmo.displayName = sortedModelObjs[i].props.swi1ObjectName.dbValues[0];
                vmo.id = vmo.uid;
                vmo.isExpanded = true;
                vmo.isLeaf = checkIsLeaf(vmo, sortedModelObjs);
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.typeIconURL = getIconSourcePath(vmo);
                vmo.parentUid = vmo.props.swi1Parent.dbValues[0];
                vmo.isVisible = false;
                children.push(vmo);
            }
            else{
                vmo.isLeaf = checkIsLeaf(vmo, sortedModelObjs);
            }
            if(vmo.isLeaf)
            {
                swiItemLeafNodes.push(vmo);
            }

            objectsToReturn.push(vmo);
        }
        else {
            if (sortedModelObjs[i].props.swi1Parent.dbValues[0] === nodeBeingExpanded.uid) {
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject(sortedModelObjs[i], 'create');
                vmo.parentUid = vmo.props.swi1Parent.dbValues[0];
                vmo.isLeaf = checkIsLeaf(vmo, sortedModelObjs);
                vmo.id = vmo.uid;
                vmo.displayName = vmo.props.swi1ObjectName.dbValues[0];
                vmo.levelNdx = nodeBeingExpanded.levelNdx + 1;
                vmo.typeIconURL = getIconSourcePath(vmo);
                vmo.isVisible = false;
                children.push(vmo);
            }
        }
    }
    if (objectsToReturn.length > 0){
        for (let i = 0; i < swiItemLeafNodes.length; i++) {

            if(i === 0)
            {
                swiItemLeafNodes[i].isPrevious =false;

            }
            else{
                swiItemLeafNodes[i].isPrevious =true;
            }
            if (i===swiItemLeafNodes.length-1)
            {
                swiItemLeafNodes[i].isNext =false;
            }
            else{
                swiItemLeafNodes[i].isNext =true;
            }
        }
        appCtxSvc.updateCtx('objGetChildren', objectsToReturn);
        appCtxSvc.updateCtx('swiItemLeafNodes', swiItemLeafNodes);
    }
    return children;
};
/**
 * Set the tree node properties
 * @param {Object} childNode response of SOA
 * @param {Array} sortedModelObjs nodeBeingExpanded of Tree
 * @return {bool} true - if node is leaf, false - if node is not leaf
 */
let checkIsLeaf = function (childNode, sortedModelObjs) {
    let isLeaf = true;
    for (let j = 0; j < sortedModelObjs.length; j++) {
        if (sortedModelObjs[j].props.swi1Parent.dbValues[0] === childNode.uid) {
            isLeaf = false;
            break;
        }
    }
    return isLeaf;
};

/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} nodeBeingExpanded nodeBeingExpanded of Tree
 * @return {Object} TreeLoadResult of all nodes
 */
export let loadTreeLoadResultForAllNodes = function (response, nodeBeingExpanded,swiAtomicData,isCollapse) {
    let modelObjects = undefined;
    let isFirstCall = true;
    let getChildrenFlag = true;
    let sortedObjectUids = response.plain;
    let response1 = [];
    let vmNodesInTreeHierarchyLevels = [];
    let expandedChildren = [];
    let rootPathsArr = [];
    if (isCollapse === true) {
        vmNodesInTreeHierarchyLevels = [{}];
        getChildrenFlag = false;
    }

    if (response.modelObjects) {
        modelObjects = response.modelObjects;
    } else if (response.ServiceData && response.ServiceData.modelObjects) {
        modelObjects = response.ServiceData.modelObjects;
    }
    
    if (modelObjects) {
        let swiObjectPropertyList = Object.values(modelObjects);
        let sortedModelObjs = swiObjectPropertyListToSequentialList(swiObjectPropertyList, sortedObjectUids);
        var expandChildren = function (nodeBeingExpanded) {
            rootPathsArr.push(nodeBeingExpanded);
            expandedChildren = getChildren(nodeBeingExpanded, sortedModelObjs, getChildrenFlag, swiAtomicData);
            isFirstCall = false;
            getChildrenFlag = false;
            vmNodesInTreeHierarchyLevels.push(expandedChildren);
            _.forEach(expandedChildren, function (childNode) {
                if (childNode.isLeaf === false) {
                    childNode.isExpanded = true;
                    expandChildren(childNode);
                }
            });
        };
        if (isFirstCall === true) {
            response1 = getChildren(nodeBeingExpanded, sortedModelObjs, getChildrenFlag, swiAtomicData);
            expandChildren(nodeBeingExpanded);
        }
    }
    if (isCollapse === true) {
      
        const treeLoadResult = {
            parentNode: nodeBeingExpanded,
            childNodes: response1,
            totalChildCount: response1.length,
            startChildNdx: 0,
            nonRootPathHierarchicalData: true,
            mergeNewNodesInCurrentlyLoadedTree: true,
            vmNodesInTreeHierarchyLevels: vmNodesInTreeHierarchyLevels,
            rootPathNodes: rootPathsArr
        };
      
        return {treeLoadResult:treeLoadResult};
    }
    else {
        return {
            parentNode: nodeBeingExpanded,
            childNodes: response1,
            totalChildCount: response1.length,
            startChildNdx: 0,
            nonRootPathHierarchicalData: true,
            vmNodesInTreeHierarchyLevels: vmNodesInTreeHierarchyLevels
        };
    }
};

let updateDataProviderAndCtx = function (dataProvider, swiAtomicData,objectToSelect,actionType)
{
    let selectedObjParent = {};
    let changeViewFlag;
    let vmoCollection = dataProvider.viewModelCollection.loadedVMObjects;
    let loadedVMOUids = [];
    appCtxSvc.updateCtx('selected', objectToSelect);
    swiAtomicData.update({ selected: objectToSelect });
    dataProvider.selectionModel.setSelection(objectToSelect.uid);

    vmoCollection.forEach(vmo => {
        loadedVMOUids.push(vmo.uid);
    });
    changeViewFlag = appCtxSvc.getCtx('changeViewFlag');
    if (loadedVMOUids.indexOf(objectToSelect.uid) === -1 && loadedVMOUids.length !== 0 && (changeViewFlag === undefined ||changeViewFlag === null || changeViewFlag === "All") && (actionType !== "onTreeLoad")) {
        selectedObjParent = getLoadedParentInVMO(loadedVMOUids, objectToSelect);
        selectedObjParent.isExpanded = true;
        eventBus.publish('serviceReqTreeTable.plTable.toggleTreeNode', selectedObjParent);
    }
};
export let setSelectedOnManual = function (dataProvider, isManualSelection, swiAtomicData, actionType) {
    let stepInformation ={};
    if (isManualSelection) {
        stepInformation = setSelectedVMO(dataProvider, isManualSelection, swiAtomicData, actionType);
    }
    return stepInformation;
};
var getLoadedParentInVMO = function (loadedVMO, objectToSelect)
{
    let objToReturn = {};
    var selectedObjParent= cdm.getObject(objectToSelect.props.swi1Parent.dbValues[0]);    
        if(loadedVMO.indexOf(selectedObjParent.uid)> -1)
        {
            objToReturn = selectedObjParent;
        } else{
            objToReturn = getLoadedParentInVMO(loadedVMO,selectedObjParent);
        }
         return objToReturn;  
};

export let setSelectedVMO = function (dataProvider, isManualSelection, swiAtomicData, actionType) {
    let swiVmoLeafNodeList = appCtxSvc.getCtx('swiItemLeafNodes');
    var index = 0;
    appCtxSvc.registerCtx('isManualSelection', false);
    appCtxSvc.updateCtx('isManualSelection', false);
    let selected = appCtxSvc.getCtx('selected');
    if (!isManualSelection) {
        if (actionType === "nextStep") {
            index = swiVmoLeafNodeList.indexOf(selected) + 1;
        }
        else if (actionType === "previousStep") {
            index = swiVmoLeafNodeList.indexOf(selected) - 1;
        }
        else if (actionType === "onTreeLoad") {
            if (selected === undefined || selected === null) {
                index = 0;
            }
            else {
                index = appCtxSvc.getCtx('selectedIndex');
            }
        }
        updateDataProviderAndCtx(dataProvider, swiAtomicData, swiVmoLeafNodeList[index],actionType);
    }
    else {
        index = swiVmoLeafNodeList.indexOf(selected);
        updateDataProviderAndCtx(dataProvider, swiAtomicData, selected,actionType);
    }
    appCtxSvc.updateCtx('selectedIndex', index);

    let stepInformation =  appCtxSvc.getCtx('selected').props.swi1ObjectName.dbValue + " "+" -" +" "+appCtxSvc.getCtx('selected').props.swi1ObjectDescription.dbValue;

    return {
        stepInformation: stepInformation
    };
};


export let isWarningType = function (){

    let isWarning = false;
    let selected = appCtxSvc.getCtx('selected');
    if(selected)
    {
        let warningObj = cdm.getObject(selected.props.swi1UnderlyingObject.dbValues[0]);
        if(warningObj.props.smr0warningType)
        {
           warningObj.props.smr0warningType.dbValues[0]==="Smr0WarningValue"? isWarning = true : isWarning = false;
        }
    }
    return { isWarning: isWarning };
};

export default exports = {
    loadServiceReqTreeTableColumns,
    loadTreeLoadResultForAllNodes,
    setSelectedVMO,
    setSelectedOnManual,
    isWarningType
};
