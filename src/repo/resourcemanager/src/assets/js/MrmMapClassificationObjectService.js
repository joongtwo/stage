// Copyright (c) 2022 Siemens

/**
 * @module js/MrmMapClassificationObjectService
 */
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import classifySvc from 'js/classifyService';
import classifyUtils from 'js/classifyUtils';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import iconSvc from 'js/iconService';
import addObjectUtils from 'js/addObjectUtils';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';

var exports = {};

/*
    This API will return target classes for a source class in which a given ICO is classified and accordingly member variables in responese will be set.
*/
export let getICOMappingTargetClasses = function (uid, viewType) {
    var serviceName = ' Internal-Manufacturing-2019-06-ResourceManagement';
    var operationName = 'getICOMappingTargets';

    var targetClasses;
    var sourceIcoID;
    var request = {
        icoUIDs: [uid],
        viewType: viewType
    };

    return soaService.post(serviceName, operationName, request)
        .then(function (response) {
            if (response.mappingInfoVector) {
                _.forEach(response.mappingInfoVector, function (mappingInfo) {
                    targetClasses = mappingInfo.targetClasses;
                    sourceIcoID = mappingInfo.sourceIcoID;
                });
            }
            return {
                numOfTargetClasses: targetClasses.length,
                targetClasses: targetClasses,
                sourceIcoID: sourceIcoID
            };
        });
};

/**
 * It returns ICO mapping data like search criteria for getting target classes details and source ICO ID.
 */
export let getICOMappingData = function (icoMappingTargetClassesOutput) {
    var searchTargetClassesCriteria = [];

    var numOfTargetClasses = icoMappingTargetClassesOutput.targetClasses.length;
    var targetClasses = icoMappingTargetClassesOutput.targetClasses;

    for (var idx = 0; idx < numOfTargetClasses; idx++) {
        searchTargetClassesCriteria.push({
            searchAttribute: classifySvc.UNCT_CLASS_ID,
            searchString: targetClasses[idx].targetID,
            sortOption: classifySvc.UNCT_SORT_OPTION_CLASS_ID
        });
    }

    let icoMappingData = { "searchTargetClassesCriteria": searchTargetClassesCriteria, "sourceIcoID": icoMappingTargetClassesOutput.sourceIcoID };

    return icoMappingData;
};

/**
 * It returns target classes list to display as list in map resoure dialog.
 */
export let getTargetClassesList = function (response) {
    var targetClassesList = [];

    if (response && response.clsClassDescriptors && !_.isEmpty(response)) {
        var classDefResponse = response.clsClassDescriptors;

        _.forEach(classDefResponse, function (classResponse) {
            var classId = classifySvc.getPropertyValue(classResponse.properties, classifySvc.UNCT_CLASS_ID);
            // Also store parentIds to be used in case of edit class. We need to expand the hierarchy upto the classified class while reclassifying.
            var parentIds = [];
            var parents = classifySvc.getParentsPath(response.classParents[classId].parents, parentIds);
            var currentClassName = classifySvc.getPropertyValue(classDefResponse[classId].properties,
                classifySvc.UNCT_CLASS_NAME);

            var iconAvailable = false;
            var iconPosition = -1;
            var ticket = {};
            if (classDefResponse && classDefResponse[classId] &&
                classDefResponse[classId].documents) {
                var documents = classDefResponse[classId].documents;
                var iconindex = 0;
                _.forEach(documents, function (document) {
                    if (document.documentType === 'icon') {
                        iconPosition = iconindex;
                    }
                    iconindex++;
                });
            }
            if (iconPosition !== -1) {
                ticket = classDefResponse[classId].documents[iconPosition].ticket;
            } else {
                // Get the class icon for the ICO's class.
                if (classDefResponse && classDefResponse[classId] &&
                    classDefResponse[classId].documents &&
                    classDefResponse[classId].documents[0]) {
                    ticket = classDefResponse[classId].documents[0].ticket;
                }
            }

            if (ticket && classifyUtils.isSupportedImageType(ticket)) {
                iconAvailable = true;
            }

            if (iconAvailable === true) {
                var imageIconUrl = browserUtils.getBaseURL() + 'fms/fmsdownload/' +
                    fmsUtils.getFilenameFromTicket(ticket) + '?ticket=' + ticket;
            } else {
                // If the class doesn't have an image, then display the 'default' icon.
                // Since we are not a real VMO, we can't use the type icon mechanism directly.
                var classifyIconName = 'typeClassificationElement48.svg';
                imageIconUrl = iconSvc.getTypeIconFileUrl(classifyIconName);
            }

            var classPath = parents.join(' > ') + ' > ' + currentClassName;
            targetClassesList.push({
                propDisplayValue: currentClassName,
                propInternalValue: classId,
                iconSource: imageIconUrl,
                targetClassPath: classPath
            });

        });
    }

    return targetClassesList;
};

/**
  * Get input data for map resource creation.
  */
export let getMapICOCreateInput = function (data, extensionVMProps, creationType, editHandlerIn) {

    var createInput = addObjectUtils.getCreateInput(data, extensionVMProps, creationType, editHandlerIn);
    var item_desc = "";
    var copyDataSets = 0;

    if (createInput[0].createData.propertyNameValues.object_desc) {
        item_desc = createInput[0].createData.propertyNameValues.object_desc[0];
    }

    if(data.copyDataset && data.copyDataset.dbValue)
    {
        copyDataSets = 1;
    }

    var mapICOCreateInput = {
        "item_id": createInput[0].createData.propertyNameValues.item_id[0],
        "item_revision_id": createInput[0].createData.compoundCreateInput.revision[0].propertyNameValues.item_revision_id[0],
        "item_name": createInput[0].createData.propertyNameValues.object_name[0],
        "item_type": createInput[0].createData.boName,
        "item_revision_type": createInput[0].createData.compoundCreateInput.revision[0].boName,
        "item_desc": item_desc,
        "copyDataSets": copyDataSets
    };

    return mapICOCreateInput;
};

/**
  * It deactivate option "Copy Dataset from Source Item" if "Import Catalog 3D Model" option is selected.
  */
export let updateCopyDatasetOptionState = function (copyDatasetCheckbox, importCatalog3DModelSelected) {
    const newCopyDatasetCheckboxCheckbox = _.clone(copyDatasetCheckbox);
    if (importCatalog3DModelSelected) {
        newCopyDatasetCheckboxCheckbox.isEnabled = false;
        newCopyDatasetCheckboxCheckbox.dbValue = false;
        newCopyDatasetCheckboxCheckbox.isEditable = false;
    } else {
        newCopyDatasetCheckboxCheckbox.isEnabled = true;
        newCopyDatasetCheckboxCheckbox.dbValue = false;
        newCopyDatasetCheckboxCheckbox.isEditable = true;
    }

    return newCopyDatasetCheckboxCheckbox;
};

/**
  * It deactivate option "Import Catalog 3D Model" "Copy Dataset from Source Item" if "Copy Dataset from Source Item" option is selected.
  */
export let updateImport3DModelOptionState = function (copyDatasetCheckboxSelected, importCatalog3DModelCheckbox) {
    const newImportCatalog3DModelCheckbox = _.clone(importCatalog3DModelCheckbox);
    if (copyDatasetCheckboxSelected) {
        newImportCatalog3DModelCheckbox.isEnabled = false;
        newImportCatalog3DModelCheckbox.dbValue = false;
        newImportCatalog3DModelCheckbox.isEditable = false;
    } else {
        newImportCatalog3DModelCheckbox.isEnabled = true;
        newImportCatalog3DModelCheckbox.dbValue = false;
        newImportCatalog3DModelCheckbox.isEditable = true;
    }

    return newImportCatalog3DModelCheckbox;
};

/*
    This API will return already mapped ICOs for given ICO id.
*/
export let isICOAlreadyMapped = function (sourceIcoID) {
    var serviceName = 'Classification-2007-01-Classification';
    var operationName = 'search';

    var existingMappedICOUID;
    var alreadyMappedICOCount = 0;
    var request = {
        searchCriteria: [
            {
                classIds: [mrmResourceGraphConstants.MRMResourceGraphConstants.ToolCompClassID],
                searchAttributes: [
                    {
                        attributeId: mrmResourceGraphConstants.MRMResourceGraphConstants.UNCT_CLASS_UNIT_SYSTEM,
                        query: mrmResourceGraphConstants.MRMResourceGraphConstants.SYS_OF_MEASUREMENT_METRIC
                    },
                    {
                        attributeId: mrmResourceGraphConstants.MRMResourceGraphConstants.CLASS_ATTR_VENDOR_REFERENCE_OBJECT_ID,
                        query: sourceIcoID
                    }
                ],
                searchOption: mrmResourceGraphConstants.MRMResourceGraphConstants.SEARCH_IN_BOTH_UNITSYSTEM
            }
        ]
    };

    return soaService.post(serviceName, operationName, request)
        .then(function (response) {
            if (response.clsObjTags) {
                _.forEach(response.clsObjTags, function (clsObjTag) {
                    if (clsObjTag.length > 0) {
                        alreadyMappedICOCount = clsObjTag.length;
                        existingMappedICOUID = clsObjTag[0].uid;
                    }
                });
            }
            return {
                alreadyMappedICOCount: alreadyMappedICOCount,
                existingMappedICOUID: existingMappedICOUID
            };
        });
};

/*
    This API will return already mapped ICO details.
*/
export let getMappedICODetails = function (mappedICOUid) {
    var serviceName = 'Classification-2011-12-Classification';
    var operationName = 'getClassificationObjectInfo';

    var existingMappedICOId;
    var existingMappedICOClassId;
    var existingMappedWSOUID;
    var request = {
        icoUids: [mappedICOUid],
        attributeIds: [],
        getOptimizedValues: true,
        fetchDescriptor: false,
        locale: ""
    };

    return soaService.post(serviceName, operationName, request)
        .then(function (response) {
            if (response.classificationObjectInfo) {
                _.forEach(response.classificationObjectInfo, function (icoInfo) {
                    existingMappedICOId = icoInfo.icoId;
                    existingMappedICOClassId = icoInfo.cid;
                    existingMappedWSOUID = icoInfo.wsoTag.uid;
                });
            }
            return {
                existingMappedICOId: existingMappedICOId,
                existingMappedICOClassId: existingMappedICOClassId,
                existingMappedWSOUID: existingMappedWSOUID
            };
        });
};

export let targetClassChange = function (currentTargetClass, targetClasses) {
    var selectedTargetClass;

    _.forEach(targetClasses, function (targetClass) {
        if (targetClass.propInternalValue === currentTargetClass.dbValue) {
            selectedTargetClass = targetClass;
        }
    });

    return {
        currentTargetClassSourceIcon: selectedTargetClass.iconSource,
        currentTargetClassName: selectedTargetClass.propDisplayValue,
        currentTargetClassPath: selectedTargetClass.targetClassPath
    };
};

export default exports = {
    getICOMappingTargetClasses,
    getICOMappingData,
    getTargetClassesList,
    getMapICOCreateInput,
    updateCopyDatasetOptionState,
    updateImport3DModelOptionState,
    isICOAlreadyMapped,
    getMappedICODetails,
    targetClassChange
};
