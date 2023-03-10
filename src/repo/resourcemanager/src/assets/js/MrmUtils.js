// Copyright (c) 2022 Siemens

/**
 * @module js/MrmUtils
 */
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';
import classifySvc from 'js/classifyService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

/*
This API will return classification information about the given component and accordingly member variables in responese will be set.
*/
export let findClassificationInfoOfComponent = function( uidInput ) {
    var serviceName = 'Internal-IcsAw-2019-12-Classification';
    var operationName = 'findClassificationInfo3';

    var isRootTurningAssy = false;
    var icoUID;
    var classParents;
    var clsObjectDefs;

    var noOfParents = 0;
    var isClassifiedinToolAssy = false;
    var request = {
        workspaceObjects: [ {
            uid: uidInput
        } ],
        searchCriterias: [],
        classificationDataOptions: 8
    };

    return soaService.post( serviceName, operationName, request )
        .then( function( response ) {
            if( response.classParents ) {
                classParents = response.classParents;
                clsObjectDefs = response.clsObjectDefs;
                icoUID = response.clsObjectDefs[1][0].clsObjects[0].clsObject.uid;
                _.forEach( response.classParents, function() {
                    noOfParents++;
                } );
                if( noOfParents === 1 ) {
                    var classID = mrmResourceGraphConstants.MRMResourceGraphConstants.UNCT_CLASS_ID;
                    _.forEach( response.classParents, function( node ) {
                        var parentList = node.parents;
                        for( var iParentIndex = 0; iParentIndex < parentList.length; iParentIndex++ ) {
                            for( var indexProp = 0; indexProp < parentList[ iParentIndex ].properties.length; indexProp++ ) {
                                if( parentList[ iParentIndex ].properties[ indexProp ].propertyId === classID &&
                                    parentList[ iParentIndex ].properties[ indexProp ].values[ 0 ].internalValue === mrmResourceGraphConstants.MRMResourceGraphConstants
                                        .ToolAssemblyTurningClassID ) {
                                    isClassifiedinToolAssy = true;
                                    isRootTurningAssy = true;
                                    break;
                                }
                                if( parentList[ iParentIndex ].properties[ indexProp ].propertyId === classID &&
                                    parentList[ iParentIndex ].properties[ indexProp ].values[ 0 ].internalValue === mrmResourceGraphConstants.MRMResourceGraphConstants
                                        .ToolAssemblyClassID ) {
                                    isClassifiedinToolAssy = true;
                                }
                            }
                            if( isClassifiedinToolAssy === true ) {
                                break;
                            }
                        }
                    } );
                }
            }
            return {
                parents: noOfParents,
                isRootTurningAssy: isRootTurningAssy,
                classifiedinToolAssy: isClassifiedinToolAssy,
                icoUID: icoUID,
                classParents: classParents,
                clsObjectDefs: clsObjectDefs
            };
        } );
};

export let getUidOfObject = function() {
    var locationCtx = appCtxService.getCtx( 'locationContext' );
    var selectedObjectUid;
    if ( locationCtx['ActiveWorkspace:SubLocation'] === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurrenceManagementSubLocationId ) {
        selectedObjectUid = appCtxService.ctx.occmgmtContext.topElement.props.awb0UnderlyingObject.dbValues[0];
    } else if ( locationCtx['ActiveWorkspace:Location'] === mrmResourceGraphConstants.MRMResourceGraphConstants.ManageResourcesLocationId ) {
        var numberOfSelectionInPWA = 0;
        if ( appCtxService.ctx.pwaSelectionInfo ) {
            numberOfSelectionInPWA = appCtxService.ctx.pwaSelectionInfo.currentSelectedCount;
        }

        if ( numberOfSelectionInPWA === 1 ) {
            var selectedObject;
            if ( !appCtxService.ctx.xrtSummaryContextObject ) {
                selectedObject = appCtxService.ctx.selected;
            } else {
                selectedObject = appCtxService.ctx.xrtSummaryContextObject;
            }

            selectedObjectUid = selectedObject.uid;
        }
    }

    return selectedObjectUid;
};

export let getUidOfSelectedObjects = function () {
    var selectedObjectUids = [];
    var locationCtx = appCtxService.getCtx('locationContext');
    var numberOfSelectionInPWA = 0;
    var isOccurrenceManagementSubLocation = locationCtx['ActiveWorkspace:SubLocation'] === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurrenceManagementSubLocationId;

    if (appCtxService.ctx.pwaSelectionInfo) {
        numberOfSelectionInPWA = appCtxService.ctx.pwaSelectionInfo.currentSelectedCount;
    }

    if (numberOfSelectionInPWA === 1) {
        if (isOccurrenceManagementSubLocation) {
            selectedObjectUids.push(appCtxService.ctx.occmgmtContext.topElement.props.awb0UnderlyingObject.dbValues[0]);
        } else if (locationCtx['ActiveWorkspace:Location'] === mrmResourceGraphConstants.MRMResourceGraphConstants.ManageResourcesLocationId) {
            var selectedObject;
            if (!appCtxService.ctx.xrtSummaryContextObject) {
                selectedObject = appCtxService.ctx.selected;
            } else {
                selectedObject = appCtxService.ctx.xrtSummaryContextObject;
            }

            if (isObjectStandAloneICO(selectedObject)) {
                selectedObjectUids.push(selectedObject.props.cls0object_id.dbValue);
            }
            else {
                selectedObjectUids.push(selectedObject.uid);
            }
        }
    }
    else if (numberOfSelectionInPWA > 1 && appCtxService.ctx.mselected) {
        if (isOccurrenceManagementSubLocation) {
            _.forEach(appCtxService.ctx.mselected, function (mselected) {
                selectedObjectUids.push(mselected.props.awb0UnderlyingObject.dbValues[0]);
            });
        }
        else {
            _.forEach(appCtxService.ctx.mselected, function (mselected) {
                if (isObjectStandAloneICO(mselected)) {
                    selectedObjectUids.push(mselected.props.cls0object_id.dbValue);
                }
                else {
                    selectedObjectUids.push(mselected.uid);
                }
            });
        }
    }

    return selectedObjectUids;
};

export let getSelectedObject = function () {
    var selectedObject;
    var numberOfSelectionInPWA = 0;
    if (appCtxService.ctx.pwaSelectionInfo) {
        numberOfSelectionInPWA = appCtxService.ctx.pwaSelectionInfo.currentSelectedCount;
    }

    if (numberOfSelectionInPWA === 1) {
        if (!appCtxService.ctx.xrtSummaryContextObject) {
            selectedObject = appCtxService.ctx.selected;
        } else {
            selectedObject = appCtxService.ctx.xrtSummaryContextObject;
        }
    }

    return selectedObject;
};

export let getUIDOfSelectedObject = function () {
    var selectedObjectUid;
    var numberOfSelectionInPWA = 0;
    if (appCtxService.ctx.pwaSelectionInfo) {
        numberOfSelectionInPWA = appCtxService.ctx.pwaSelectionInfo.currentSelectedCount;
    }

    if (numberOfSelectionInPWA === 1) {
        if (!appCtxService.ctx.xrtSummaryContextObject) {
            selectedObjectUid = appCtxService.ctx.selected.uid;
        } else {
            selectedObjectUid = appCtxService.ctx.xrtSummaryContextObject.uid;
        }
    }

    return selectedObjectUid;
};

/**
 * It returns internal item name of given item revision internal name.
 * @param {String} theItemRevisionName - internal name of item revision.
 */
function getItemName( theItemRevisionName ) {
    var itemName = theItemRevisionName;
    var startIndex = theItemRevisionName.indexOf( 'Revision' );
    if ( startIndex > 0 ) {
        itemName = theItemRevisionName.substr( 0, startIndex ).trim();
    }

    return itemName;
}

export let getCreateDefaultResourceTypes = function( ) {
    var numOfCreateDefaultResourceTypes = appCtxService.ctx.preferences.MRMCreateDefaultResourceTypes ? appCtxService.ctx.preferences.MRMCreateDefaultResourceTypes.length : 0;
    var createDefaultResourceTypesStr = '';
    if( numOfCreateDefaultResourceTypes > 0 ) {
        for( var idx = 0; idx < numOfCreateDefaultResourceTypes; idx++ ) {
            createDefaultResourceTypesStr += appCtxService.ctx.preferences.MRMCreateDefaultResourceTypes[idx];
            if( idx < numOfCreateDefaultResourceTypes - 1 ) {
                createDefaultResourceTypesStr += ',';
            }
        }
    } else {
        // Use resource type "WorkspaceObject" if preference "MRMCreateDefaultResourceTypes" is not found.
        createDefaultResourceTypesStr = 'WorkspaceObject';
    }

    return createDefaultResourceTypesStr;
};

function getPreferredTypeForStandAloneICO( classParents, clsObjectDefs ) {
    var mrmItemTypesPrefValues = appCtxService.ctx.preferences.MRMItemTypes;
    if ( mrmItemTypesPrefValues ) {
        //If any class id from ICO's classification hierarchy mentioned in the preference "MRMItemTypes",
        //then preferred type will be taken from the preference for this class.
        var classID = classifySvc.UNCT_CLASS_ID;
        var numOfClassIds = mrmItemTypesPrefValues.length / 2;
        var icoClassificationHierarchy = [];

        var classificationObj = clsObjectDefs[1][0].clsObjects[0];
        var nonBlockOrClassProperties = classificationObj.properties;
        var icoClassId = classifySvc.getPropertyValue( nonBlockOrClassProperties, classifySvc.UNCT_CLASS_ID );
        //ICO's class is not part of parents so added it in ICO's classification hierarchy.
        icoClassificationHierarchy.push( icoClassId );
        _.forEach( classParents, function( node ) {
            var parentList = node.parents;
            for ( var parentIndex = 0; parentIndex < parentList.length; parentIndex++ ) {
                for ( var propIndex = 0; propIndex < parentList[parentIndex].properties.length; propIndex++ ) {
                    if ( parentList[parentIndex].properties[propIndex].propertyId === classID ) {
                        icoClassificationHierarchy.push( parentList[parentIndex].properties[propIndex].values[0].internalValue );
                    }
                }
            }
        } );

        var parentClass;

        for ( var idx = 0; idx < icoClassificationHierarchy.length; idx++ ) {
            parentClass = icoClassificationHierarchy[idx];
            for ( var j = 0; j < numOfClassIds; j += 2 ) {
                if ( parentClass === mrmItemTypesPrefValues[j] ) {
                    return mrmItemTypesPrefValues[j + 1];
                }
            }
        }
    }

    return 'Mfg0MEResource';
}

/**
 * It returns data for create new resource based on selected object(s), based on this data "Create Resource" dialog will be rendered and accordingly new resource will be created.
 */
export let getCreateNewResourceData = function( classParents, clsObjectDefs ) {
    var createNewResourceData = {};
    createNewResourceData.createDefaultResourceTypes = getCreateDefaultResourceTypes();

    var numOfCreateDefaultResourceTypes = appCtxService.ctx.preferences.MRMCreateDefaultResourceTypes ? appCtxService.ctx.preferences.MRMCreateDefaultResourceTypes.length : 0;

    if( numOfCreateDefaultResourceTypes > 0 ) {
        createNewResourceData.loadSubTypes = false;
    } else{
        createNewResourceData.loadSubTypes = true;
    }

    var numberOfSelectionInPWA = 0;
    if ( appCtxService.ctx.pwaSelectionInfo ) {
        numberOfSelectionInPWA = appCtxService.ctx.pwaSelectionInfo.currentSelectedCount;
    }

    if ( numberOfSelectionInPWA === 1 ) {
        var selectedObject;
        if ( !appCtxService.ctx.xrtSummaryContextObject ) {
            selectedObject = appCtxService.ctx.selected;
        } else {
            selectedObject = appCtxService.ctx.xrtSummaryContextObject;
        }

        createNewResourceData.isSelectedObjectStandAloneICO = isObjectStandAloneICO( selectedObject );

        if ( createNewResourceData.isSelectedObjectStandAloneICO ) {
            createNewResourceData.preferredType = getPreferredTypeForStandAloneICO( classParents, clsObjectDefs );
        } else {
            var locationCtx = appCtxService.getCtx( 'locationContext' );
            if( locationCtx[ 'ActiveWorkspace:SubLocation' ] === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurrenceManagementSubLocationId ) {
                var underLineRevObjectType;
                if (selectedObject.props && selectedObject.props.awb0UnderlyingObject) {
                    var underLineRevObject = cdm.getObject(selectedObject.props.awb0UnderlyingObject.dbValues[0]);
                    underLineRevObjectType = underLineRevObject.type;
                }
                else {
                    underLineRevObjectType = selectedObject.type;
                }

                createNewResourceData.preferredType = getItemName(underLineRevObjectType);
            } else {
                createNewResourceData.preferredType = getItemName(selectedObject.type);
            }
        }
    } else {
        //Nothing or multiple selection
        createNewResourceData.preferredType = 'Mfg0MEResource';
    }

    return createNewResourceData;
};

/**
 * It returns true if the given object is stand alone ICO, othewsie returns false.
 * @param {Object} theObject - the object
 */
function isObjectStandAloneICO ( theObject ) {
    if ( theObject.modelType && theObject.modelType.typeHierarchyArray
        && ( theObject.modelType.typeHierarchyArray.indexOf( 'Cls0Object' ) > -1 || theObject.modelType.typeHierarchyArray.indexOf( 'Cls0CstObject' ) > -1 ) ) {
        return true;
    }
    return false;
}

export default exports = {
    findClassificationInfoOfComponent,
    getUidOfObject,
    getCreateNewResourceData,
    getUidOfSelectedObjects,
    getCreateDefaultResourceTypes,
    getSelectedObject,
    getUIDOfSelectedObject
};
