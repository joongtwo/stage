// Copyright (c) 2022 Siemens

/**
* Service to provide utilities to activities tree
*
* @module js/ssp0ActivityUtilityService
*/

import _ from 'lodash';
import addObjectUtils from 'js/addObjectUtils';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import { constants as timeAnalysisConstants } from 'js/ssp0TimeAnalysisConstants';
import viewModelObjectService from 'js/viewModelObjectService';

const RESOURCE_MESSAGE = 'timeAnalysisMessages';
const ID_Name = 'new_object_id';
const TIME_MANAGEMENT_PROPERTIES = [ timeAnalysisConstants.BOMLINE_WORK_TIME, timeAnalysisConstants.BOMLINE_DURATION_TIME,
    timeAnalysisConstants.ACTIVITY_WORK_TIME, timeAnalysisConstants.ACTIVITY_DURATION_TIME ];
var exports = {};

/**
 *
 * @param {string} IdName - a given id name
 * @return {string} a random and unique ID
 */
function generateUniqueId( IdName ) {
    return `${IdName}${Math.random().toString()}`;
}

/**
 * Add activity to selected activity
 * @param {Object} data data
 * @param {String} createType createType
 */
export let addActivity = function( data, createType ) {
    let operationVMOUid = appCtxSvc.getCtx( 'state' ).params.uid;
    let selectedActivityVMO = appCtxSvc.getCtx( 'selectedActivity' );
    let operationVMO = { uid: operationVMOUid, type: timeAnalysisConstants.TYPE_WORK_CARD_PROCESS };
    const getCreateInput = addObjectUtils.getCreateInput( data, '', createType );
    const id = generateUniqueId( ID_Name );
    const nameToValuesMap = {
        id: [ id ],
        Type: [
            createType
        ],
        connectTo: [
            selectedActivityVMO.uid
        ],
        owningOperation: [
            operationVMOUid
        ]
    };
    let body = _initSectionInput( 'ObjectsToCreate', nameToValuesMap );
    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    const itemPropertyNamesValues = getCreateInput[0].createData.propertyNameValues;
    _addRelatedObjects( body, operationVMO );
    _addRelatedObjects( body, selectedActivityVMO );
    _addEntries( entryAnchor, 'ItemProps', itemPropertyNamesValues );
    _addActivity( body, selectedActivityVMO );
};
/**
 * Remove activity from activity Tree
 * @param {String} createType createType
 */
export let removeActivity = function( createType ) {
    let selectedActivityVMO = appCtxSvc.getCtx( 'selectedActivity' );
    let parentObject = appCtxSvc.getCtx( 'rootActivityOfTree' ).loadedVMObjects[0];
    const nameToValuesMap = {
        Type: [
            createType
        ],
        connectTo: [
            parentObject.uid
        ],
        id: [
            selectedActivityVMO.uid
        ]
    };
    let body = _initSectionInput( 'ObjectsToDelete', nameToValuesMap );
    _addRelatedObjects( body, selectedActivityVMO );
    _setActivityProperties( body );
};

/**
 * set Activity Property
 * @param {Object} dataProvider dataProvider
 */
export let setActivityProperty = function( dataProvider ) {
    const modifiedProperty = dataProvider.viewModelCollection.getAllModifiedProperties()[0];
    const vmo = modifiedProperty.viewModelObject;
    const property = modifiedProperty.property;
    if ( vmo && property ) {
        const body = _setActivityPropertiesBody( vmo, property );
        _setActivityProperties( body );
    }
};

let _setActivityPropertiesBody = function( vmo, property ) {
    let body = _initSectionInput( 'ObjectsToModify', {
        id: [
            vmo.uid
        ]
    } );
    let entryAnchor = body.saveInput.sections[0].dataEntries[0].entry;
    _addEntries( entryAnchor, 'Prop', {
        [property.propertyName]: [
            property.dbValue
        ]
    } );

    _addRelatedObjects( body, vmo );
    return body;
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

let checkForErrors = function( result ) {
    return result.ServiceData.partialErrors && result.ServiceData.partialErrors.length > 0 && result.ServiceData.partialErrors[0] && result.ServiceData.partialErrors[0].errorValues;
};

export let getChildNode = function( modelObjects, selectedActivityVmo ) {
    return Object.values( modelObjects ).filter( modelObject => modelObject.type === 'CfgActivityLine' && modelObject.uid !== selectedActivityVmo.uid )[0];
};

export let getTreeNode = function( dataProvider, modelObject ) {
    return modelObject && _.find( dataProvider.viewModelCollection.getLoadedViewModelObjects(), ( loadedVmo ) => loadedVmo.uid === modelObject.uid );
};

export let newNodeAdded = function( result, dataProvider ) {
    let selectedVMO = appCtxSvc.getCtx( 'selectedActivity' );
    let childNode = getChildNode( result.modelObjects, result.plain[0] );
    const parentTreeNode = getTreeNode( dataProvider, selectedVMO );
    appendChildNodes( parentTreeNode, childNode, dataProvider );
};

export let getTreeNodeObject = function( nodeObject, parentNode, isLeaf, childNdx, displayNameProp = 'object_string' ) {
    if ( !viewModelObjectService.isViewModelObject( nodeObject ) ) {
        nodeObject = viewModelObjectService.createViewModelObject( nodeObject );
    }
    let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( nodeObject, 'create' );
    if ( nodeObject.props.object_string ) {
        vmo.displayName = nodeObject.props.object_string.dbValues[0];
        vmo.levelNdx = parentNode.levelNdx + 1;
        vmo.underlyingObjectType = nodeObject.type;
        vmo.isVisible = false;
    }
    if ( nodeObject.props.al_activity_awp0HasChildren ) {
        vmo.isLeaf = nodeObject.props.al_activity_awp0HasChildren.dbValues[0] === 'False';
    }
    vmo.alreadyExpanded = false;
    if ( !vmo.props ) {
        vmo.props = nodeObject.props;
    }
    return vmo;
};

export let appendChildNodes = function( parentTreeNode, childObjects, dataProvider ) {
    if ( !parentTreeNode.children ) {
        parentTreeNode.children = [];
    }
    parentTreeNode.isLeaf = false;
    const childIndex = parentTreeNode.children.length;
    let childNdx = childIndex;
    const childTreeNodes = getTreeNodeObject( childObjects, parentTreeNode, true, childNdx++ );
    const loadedVmos = [ ...dataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let refIndex = loadedVmos.indexOf( parentTreeNode );
    const descendantTreeNodes = getAllDescendantTreeNodes( parentTreeNode );
    descendantTreeNodes.forEach( descendant => {
        let index = loadedVmos.indexOf( descendant );
        if ( index > refIndex ) {
            refIndex = index;
        }
    } );
    loadedVmos.splice( refIndex + 1, 0, childTreeNodes );
    parentTreeNode.children.splice( childIndex, 0, childTreeNodes );

    dataProvider.update( loadedVmos, loadedVmos.length );
    setSelectionOfAddedNode( dataProvider, childTreeNodes );
};

export let setSelectionOfAddedNode = function( dataProvider, nodeToSelect ) {
    const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    const loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToSelect.uid );
    dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
};

/**
 * Returns all of the decendant tree nodes
 * @param {ViewModelTreeNode} treeNode - a given tree node object
 * @return {ViewModelTreeNode[]} array of tree node objects
 */
export let getAllDescendantTreeNodes = function( treeNode ) {
    const descendants = [];
    if ( !treeNode.isLeaf && treeNode.children && treeNode.children.length > 0 ) {
        treeNode.children.forEach( ( childTreeNode ) => {
            descendants.push( ...getAllDescendantTreeNodes( childTreeNode ) );
        } );
        descendants.push( ...treeNode.children );
    }
    return descendants;
};

let _addActivity = function( body, selectedActivityVMO ) {
    let promise = _saveData3SOA( body );
    promise.then( ( result ) => {
        if ( checkForErrors( result ) ) {
            msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
            return result;
        }

        let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
        msgSvc.showInfo( localTextBundle[timeAnalysisConstants.MSG_ACTIVITY_CREATED] );
        if ( selectedActivityVMO.props.al_activity_time_system_unit_time.dbValue !== '0.' ) {
            selectedActivityVMO.props.al_activity_time_system_unit_time.dbValue = '0';
            let property = selectedActivityVMO.props.al_activity_time_system_unit_time;
            const body = _setActivityPropertiesBody( selectedActivityVMO, property );
            _setActivityProperties( body );
        }

        // Expand Logic
        let modelObjects = result.ServiceData.modelObjects;
        let childNode = getChildNode( modelObjects, selectedActivityVMO );
        if ( selectedActivityVMO && selectedActivityVMO.isExpanded ) {
            eventBus.publish( 'SSP0ActivityTree.newNodeAdded', {
                soaResult: result,
                childNodeUid: childNode.uid
            } );
        } else {
            eventBus.publish( 'SSP0ActivityTree.expandSelectedNode', {
                nodeToBeExpanded: selectedActivityVMO,
                nodeToBeSelected: childNode
            } );
        }
        return result;
    } );
};

export let expandSelectedNode = function( nodeToBeExpanded, nodeToBeSelected, dataProvider ) {
    if ( dataProvider !== null ) {
        let vmos;
        let vmoCollection = dataProvider.getViewModelCollection().loadedVMObjects;
        vmos = vmoCollection.filter( obj => {
            return obj.uid === nodeToBeExpanded.uid;
        } );
        if ( vmos && vmos.length === 1 ) {
            if ( !vmos[0].isExpanded ) {
                vmos[0].isExpanded = true;
                vmos[0].isLeaf = false;
                if ( nodeToBeSelected ) {
                    const subscribeTreeNodesLoaded = eventBus.subscribe( 'activityDataProvider.treeNodesLoaded', function( eventData ) {
                        let loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
                        let loadedObjectToToSelect = null;

                        loadedObjectToToSelect = loadedObjects.filter( loadedObj => loadedObj.uid === nodeToBeSelected.uid );

                        dataProvider.selectionModel.setSelection( loadedObjectToToSelect );
                        eventBus.unsubscribe( subscribeTreeNodesLoaded );
                    } );
                }
                eventBus.publish( 'activitiesTreeTable.plTable.toggleTreeNode', vmos[0] );
            }
        } else {
            // Log the errors
        }
    }
};

let _setActivityProperties = function( body ) {
    let promise = _saveData3SOA( body );
    promise.then( ( result ) => {
        if ( checkForErrors( result ) ) {
            msgSvc.showError( result.ServiceData.partialErrors[0].errorValues[0].message );
            return result;
        }
        let promise = _updateTimeManagementPropertiesSOA();
        promise.then( ( result ) => {
            eventBus.publish( 'reloadActivitiesTree' );
            return result;
        } );
    } );
};

let _saveData3SOA = function( body ) {
    return soaService.postUnchecked( 'Internal-MfgBvrCore-2016-04-DataManagement', 'saveData3', body );
};
let _updateTimeManagementPropertiesSOA = function() {
    const setPropertyBody = {
        rootNodes: [ { uid: appCtxSvc.getCtx( 'state' ).params.uid, type: timeAnalysisConstants.TYPE_WORK_CARD_PROCESS } ],
        fieldNames: TIME_MANAGEMENT_PROPERTIES
    };
    return soaService.postUnchecked( ' Manufacturing-2010-09-TimeManagement', 'updateTimeManagementProperties', setPropertyBody );
};


export default exports = {
    addActivity,
    setActivityProperty,
    removeActivity,
    newNodeAdded,
    expandSelectedNode
};
