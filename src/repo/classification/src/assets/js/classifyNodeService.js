// Copyright (c) 2022 Siemens

/**
 * Defines {@link classifyNodeService}
 *
 * @module js/classifyNodeService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import classifyFilterUtils from 'js/classifyFilterUtils';
import classifyViewSvc from 'js/classifyViewService';
import classifySvc from 'js/classifyService';
import classifyTblSvc from 'js/classifyFullviewTableService';
import classifyUtils from 'js/classifyUtils';
import { updateResponseState } from 'js/Ics1ClassificationTabService';
import classifyDefinesService from 'js/classifyDefinesService';
import messagingService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';

var exports = {};
var suggestedClassSelected = false;

/**
 * Get Prop Details

 * @param {Object} classifyState classify state
 * @return {Object} the prop Details
 */
export let getNodeData = function( classifyState ) {
    if ( classifyState.value.selectedNode ) {
        return classifyState.value.selectedNode;
    }
    return null;
};

let buildSearchInput = function( data, ico, workspaceObjectUid ) {
    var request = {
        workspaceObjects: [],
        searchCriterias: [],
        classificationDataOptions: classifySvc.loadStorageAttributes + classifySvc.LOAD_CLASS_UNITS
    };
    // it's been used for edit mode and view mode
    if( ico && ico.classID === data.selectedClass.id ) {
        request.workspaceObjects[0] =  {
            uid: data.ico.uid
        };
    } else {
        var searchCriteria = {
            searchAttribute: classifySvc.UNCT_CLASS_ID,
            searchString: data.selectedClass.id,
            sortOption: classifySvc.UNCT_SORT_OPTION_CLASS_ID
        };

        if( workspaceObjectUid && workspaceObjectUid.length > 0 ) {
            request.workspaceObjects[0] =  {
                uid: workspaceObjectUid
            };
            request.searchCriterias[0] = searchCriteria;
            request.classificationDataOptions = classifySvc.loadStorageAttributes + 8192 + classifySvc.LOAD_CLASS_UNITS;
        } else{
            request.searchCriterias[0] = searchCriteria;
            request.classificationDataOptions = classifySvc.loadStorageAttributes;
        }
    }
    return request;
};

/**
 * Formats the classification class Image attachments so that they can be displayed in the UI.
 *
 * @param {Object} data - The view-model data object
 */
let formatImageAttachments = function( data ) {
    var imageInfo = classifyUtils.formatImageAttachments( data.datasetFilesOutput );
    var imageURLs = imageInfo.imageURLs;
    var viewDataArray = imageInfo.viewDataArray;
    data.clsImgAvailable = imageURLs.length > 0;


    data.totalNoOfImages = imageURLs.length;
    //Set initial image to be selected in ribbon
    if( viewDataArray.length > 0 ) {
        viewDataArray[0].selected = true;
    }
    data.ribbonIncr = 0;
    data.viewerData = viewDataArray[ 0 ];
    data.index = 0;
    data.viewDataArray = viewDataArray;
    data.imageURLs = imageURLs;
};

let getValuesMap = function( data, isPasteClicked, suggestedClassSelected, classifyState, selectedClassId ) {
    var valuesMap = null;
    if( isPasteClicked === true ) {
        if( data.clsObjInfo ) {
            valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClassId, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
        }
    } else if( data.clsObjInfo && data.ico ) {
        valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClassId, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
    } else if( data.clsObjInfo && suggestedClassSelected === true ) {
        suggestedClassSelected = false;
        valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClassId, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
    } else if( data.panelMode === 0 && typeof data.localPropertyValues === 'object' && !data.clearProperties ) {
        valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClassId, data.localPropertyValues.properties, data.localPropertyValues.blockDataMap );
    } else if(  classifyState.value.panelMode === 0 &&
                classifyState.value.editClassCmd &&
                ( classifyState.value.editClassCmd.targetClassID === selectedClassId || classifyState.value.editClassCmd.replaceAttrs ) ) {
        valuesMap = classifyUtils.getClsUtilValueMap( data, selectedClassId, data.clsObjInfo.properties, data.clsObjInfo.blockDataMap );
    }

    return valuesMap;
};

/**
 * Update cell tooltips
 * @param {ObjectArray} cellProps cell props
 * @param {ObjectArray} propValues prop values
 */
function updateCellProps( cellProps, propValues ) {
    if( propValues && typeof propValues === 'object' ) {
        _.forEach( cellProps, function( prop ) {
            if( prop.key === 'Date Modified' ) {
                var lastModifiedDate = classifySvc.getPropertyValue( propValues.properties, classifySvc.UNCT_MODIFY_DATE );
                if( lastModifiedDate ) {
                    lastModifiedDate = classifyUtils.convertClsDateToAWTileDateFormat( lastModifiedDate );
                }
                prop.value = lastModifiedDate.displayValue;
            }
            if( prop.key === 'Modified User' ) {
                var lastModifiedUser = classifySvc.getPropertyValue( propValues.properties, classifySvc.UNCT_MODIFY_USER );
                prop.value = lastModifiedUser;
            }
        } );
    }
}

/**
 * Sets the unit system state on the panel.
 *
 * @param {Object} data - The viewmodel data object
 * @param {Object} classifyState - classify state
 */
let setUnitSystem = function( data, classifyState ) {
    var unitSystemEnabled;

    data.unitSystem = data.unitSystem ? data.unitSystem : {};
    var panelMode = classifyState.value ? classifyState.value.panelMode : classifyState.panelMode;

    if ( panelMode === 0 && !data.standaloneObjectExists || panelMode === 1 && data.editClassInProgress ) {
        var classUnitSystem;
        if( data.classDefinitionMapResponse ) {
            classUnitSystem = classifySvc.getPropertyValue(
                data.classDefinitionMapResponse[ classifyState.value.selectedNode.id ].properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM );


            data.unitSystem.dbValue = classUnitSystem === 'metric' || classUnitSystem === 'both';
            unitSystemEnabled = classUnitSystem === 'both';

            data.unitSystem.isEditable = unitSystemEnabled;
            data.unitSystem.isEnabled = unitSystemEnabled;
        }
    } else if( ( panelMode === -1 || data.standaloneObjectExists && !data.createForStandalone ) &&
        data.clsObjInfo || data.panelMode === 1 && data.pasteIsClicked === true ) {
        var icoUnitSystem = classifySvc.getPropertyValue( data.clsObjInfo.properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM );
        data.unitSystem.dbValue = icoUnitSystem === 'metric' || icoUnitSystem === 'UNSPECIFIED';
        if( data.classDefinitionMapResponse ) {
            unitSystemEnabled = classifySvc.getPropertyValue(
                data.classDefinitionMapResponse[ data.selectedClass.id ].properties, classifySvc.UNCT_CLASS_UNIT_SYSTEM ) === 'both';
        }
        data.unitSystem.isEditable = unitSystemEnabled;
        data.unitSystem.isEnabled = unitSystemEnabled;
    }
};

/**
 * Formats the classification attributes so they can be displayed in the ui.
 *
 * @param {Object} data - The viewmodel data object
 * @param {Object} classifyState - classify state
 * @param {Object} responseState - response state
 * @param {boolean} isPasteClicked tried if paste else otherwise
 * @param {Object} targetObject target object
 * @return {OBJECT} data
 */
let formatAttributes = function( data, classifyState, responseState, isPasteClicked, targetObject ) {
    setUnitSystem( data, classifyState );

    //Set the visibility of panel sections;
    data.hierarchyVisible = true;
    data.attributesVisible = true;
    var attributesDefinitions = null;

    //Format the attributes for display
    if( data.classDefinitionMapResponse ) {
        if( isPasteClicked === true ) {
            var icoHeader = targetObject.cellInternalHeader1;
            attributesDefinitions = data.classDefinitionMapResponse[ icoHeader].attributes;
        } else {
            attributesDefinitions = data.classDefinitionMapResponse[ data.selectedClass.id ].attributes;
            data.classesProperties = data.classDefinitionMapResponse[ data.selectedClass.id ].properties;
            data.selectedClass.classUid = classifySvc.classUidObjectForImageViewer( data.classesProperties );
            appCtxSvc.ctx.classesProperties = [];
        }
    }
    data.attr_anno = [];
    data.prop_anno = [];
    var valuesMap = getValuesMap( data, isPasteClicked, suggestedClassSelected, classifyState, data.selectedClass.id );

    if( attributesDefinitions ) {
        classifySvc.formatAttributeArray( data, responseState, attributesDefinitions, valuesMap, data.attr_anno, '', false, false, null, null, data.clearProperties );
        if( classifyState.value.standAlone ) {
            var id = buildStandaloneIDField( data, responseState );
            data.attr_anno.unshift( id[0] );
        }
    }
    if( data.selectedCell ) {
        //update cell extended Props for selected class
        updateCellProps( data.selectedCell.cellExtendedTooltipProps, valuesMap );
    }
    //handle any filter from preview
    classifyFilterUtils.filterProperties( data );
    classifyViewSvc.populatePropertyGroupTree( data.attr_anno );
    data.filteredPropGroups = data.attr_anno;
    return data;
};


/**
 * Creates a new entry for data.attr_anno to display an id field for standalone classification.
 * @param {*} data The declarative view model
 * @param {*} responseState response state
 * @returns {Array} attr anno
 */
let buildStandaloneIDField = function( data, responseState  ) {
    var metricAndNonMetric = {
        unitName: '',
        defaultValue: '',
        minimumValue: '',
        maximumValue: '',
        formatDefinition: {
            formatType: 0,
            formatModifier1: 0,
            formatModifier2: 0,
            formatLength: 80
        }
    };

    var id = classifyDefinesService.ATTRIBUTE_ID_LABEL;
    var ico_ID = classifyDefinesService.UNCT_ICO_UID;
    var ATTRIBUTE_NAME = classifyDefinesService.UNCT_CLASS_ATTRIBUTE_NAME;
    var zero = 0;

    data.standalone_attr_anno = [];
    var attributesDefinitions = [ {
        attributeId: ico_ID,
        arraySize: zero,
        options: zero,
        metricFormat: metricAndNonMetric,
        nonMetricFormat: metricAndNonMetric,
        attributeProperties: [
            {
                propertyId: ATTRIBUTE_NAME,
                propertyName: '',
                values: [
                    {
                        internalValue: id,
                        displayValue: id
                    }
                ]
            }
        ]
    } ];

    classifySvc.formatAttributeArray( data, responseState, attributesDefinitions, null, data.standalone_attr_anno, '', false, false, null, null, null );

    //setting this to make the id field required
    if( data.standalone_attr_anno ) {
        data.standalone_attr_anno[0].vmps[0].isRequired = true;
    }

    return data.standalone_attr_anno;
};

/**
 *  Following method processes the findClassificationInfo2 SOA response and make initializations on view model
 * @param {*} response findClassificationInfo2 SOA response
 * @param {*} data Declarative view model
 * @param {*} classifyState classify state
 * @param {*} responseState response state
 * @param {*} isPasteClicked true of paste clicked, false otherwise
 * @param {*} targetObject target object
 * @param {*} classifyStateUpdater atomic data
 */
export let formatDataAndResponse = function( response, data, classifyState, responseState, isPasteClicked, targetObject, classifyStateUpdater ) {
    // Contains list of class IDs and ClassDef info
    data.classDefinitionMapResponse = response.clsClassDescriptors;
    // Contains attributeDefinitionMap and configuredKeyLOVDefinitionMap
    // List of KeyLOV ID, and KeyLOV definition ( KeyLOVDefinition2 )
    data.keyLOVDefinitionMapResponse = response.keyLOVDescriptors;
    data.blockDefinitionMapResponse = response.clsBlockDescriptors;
    data.unitMap = response.unitMap;

    if ( response.clsObjectDefs ) {
        data.clsObjInfo = response.clsObjectDefs[ 1 ][ 0 ].clsObjects[ 0 ];
        _.forEach( response.clsObjectDefs[ 1 ][ 0 ].clsObjects, function( clsObject ) {
            let getPropertyValueResult = classifySvc.getPropertyValue( clsObject.properties, classifySvc.UNCT_CLASS_ID ) === data.selectedClass.id;
            if( getPropertyValueResult && ( clsObject.clsObject.uid === data.selectedClass.uid || clsObject.clsObject.uid === classifyState.value.editClassUID ) ) {
                data.clsObjInfo = clsObject;
            }
        } );
    } else {
        data.clsObjInfo = null;
    }

    // Process image panel only if the image dataset is available
    data.expandImagesPanel = false;
    data.clsImgAvailable = false;


    if( isPasteClicked ) {
        data.datasetFilesOutput = targetObject.documents;
    } else if( data.classDefinitionMapResponse && data.classDefinitionMapResponse[ data.selectedClass.id ].documents &&
        !data.classDefinitionMapResponse[ data.selectedClass.id ].documents.isEmpty ) {
        data.datasetFilesOutput = data.classDefinitionMapResponse[ data.selectedClass.id ].documents;
    }
    if( data.classDefinitionMapResponse && !isPasteClicked ) {
        formatImageAttachments( data );
    }
    data.unitSystem = data.unitSystem ? data.unitSystem : {};
    data.showAllProp = data.panelMode === 0 ? true : data.showAllProp;
    if( data.classDefinitionMapResponse ) {
        formatAttributes( data, classifyState, responseState, isPasteClicked, targetObject );
    }

    var cardinalAttr = data.attr_anno ? classifyTblSvc.getCardinalBlock( data.attr_anno ) : null;
    if( cardinalAttr && !cardinalAttr.tableView ) {
        //check if it was in table view. If so, continue
        var ctx1 = appCtxSvc.getCtx( 'classifyTableView' );
        if( ctx1 && ctx1.attribute.blockId === cardinalAttr.blockId ) {
            data.searchResults = null;
            ctx1.noReload = false;
            ctx1.attribute = cardinalAttr;
            ctx1.attribute.tableView = true;
            appCtxSvc.updateCtx( 'classifyTableView', ctx1 );
        } else {
            appCtxSvc.unRegisterCtx( 'classifyTableView' );
            data.searchResults = null;
        }
    }
    if( data.attr_anno && isPasteClicked === true ) {
        data.attributesVisible = false;
        data.clsImageAvailable = false;
        var pasteObject = {
            isPasteClicked : true,
            targetObject : targetObject,
            panelMode : 1
        };
        updateClassifyStateAttrs( classifyState, data, pasteObject );
    } else {
        updateClassifyStateAttrs( classifyState, data );
    }
};

/**
 * Updates classify state with attributes.
 *
 * @param {Object} classifyState classify state
 * @param {Object} data data
 * @param {Object} pasteObject Obect structure
 */
export let updateClassifyStateAttrs = function( classifyState, data, pasteObject ) {
    const tmpState = { ...classifyState.value };
    tmpState.numOfAttrs = data.attr_anno ? data.attr_anno.length : 0;
    tmpState.attrs = data.attr_anno;
    tmpState.currentUnitSystem = data.unitSystem;
    tmpState.hasBlocks = data.hasBlocks;
    tmpState.hasImages = data.clsImgAvailable;
    tmpState.classParents = data.classParents;
    if( tmpState.isClassifyPanel && tmpState.hasBlocks && !tmpState.showPropTree ) {
        tmpState.showPropTree = false;
    } else if( tmpState.hasBlocks && !tmpState.showPropTree ) {
        tmpState.showPropTree = true;
    } else {
        tmpState.selectedPropertyGroup = null;
    }
    if( pasteObject && pasteObject.isPasteClicked  ) {
        tmpState.pasteClicked = true;
        tmpState.targetObject = pasteObject.targetObject;
        tmpState.panelMode = pasteObject.panelMode;
        tmpState.pasteInProgress = true;
    }
    if( tmpState.editClassCmd && data.selectedClass && tmpState.editClassCmd.targetClassID === data.selectedClass.id  ) {
        tmpState.editClassCmd.alreadyShownEditClassAttr = true;
        tmpState.editClassCmd.replaceAttrs = tmpState.attrs;
    }

    tmpState.classifyUnitsEnabled = data.unitSystem ? data.unitSystem.isEnabled : false;
    tmpState.selectedClass = data.selectedClass;
    tmpState.dAttributeStruct = data.dAttributeStruct;
    tmpState.updateInstances = data.updateInstances;
    classifyState.update( tmpState );
};

/**
 * Following method deals with fetching attributes information for given ICO in paste mode
 * @param {Object} data Declarative view model
 * @param {Object} classifyState classify State object
 * @param {Object} responseState response state
 * @param {Object} targetObject Target WSO object
 * @param {Object} classifyStateUpdater State updater
 */
export let getAttributesForPaste = function( data, classifyState, responseState, targetObject, classifyStateUpdater ) {
    var request = {
        workspaceObjects: [],
        searchCriterias: [],
        classificationDataOptions: classifySvc.loadStorageAttributes + classifySvc.LOAD_CLASS_UNITS
    };

    var uid = targetObject.uid;
    request.workspaceObjects[0] =  {
        uid: uid
    };

    soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then(
        function( response ) {
            updateResponseState( response, responseState );
            exports.formatDataAndResponse( response, data, classifyState, responseState, true, targetObject, classifyStateUpdater );
        } );
};

/*
 * gets the attribute data for rendering classification widgets & calls the attribute formatting method.
 *
 * @param {Object} data  the declarative viewmodel data
 * @param {Object} classifyState classify state
 * @param {Object} responseState respnse state
 * @param {Object} workspaceObjectUid workspace object uid
 */
export let getAttributes = function( data, classifyState, responseState, workspaceObjectUid  ) {
    var request;
    var ico = data.ico;

    // If we already have attribute information, do not proceed to get information again
    if( !data.attr_anno ) {
        request = buildSearchInput( data, ico, workspaceObjectUid );

        soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then(
            function( response ) {
                // get property data if it is returned
                if( response.clsObjectDefs ) {
                    response.clsObjectDefs[ 1 ][ 0 ].clsObjects.forEach( function( clsObjInfo ) {
                        for( var p in clsObjInfo.properties ) {
                            if( clsObjInfo.properties[ p ].propertyId === classifySvc.UNCT_CLASS_ID ) {
                                data.clsObjInfo = clsObjInfo;
                                break;
                            }
                        }
                    }, data );
                }
                updateResponseState( response, responseState );
                exports.formatDataAndResponse( response, data, classifyState, responseState, false );
            } );
    }
};

/**
  * detects if a selected node is storage node or hierarchy node and calls the corresponding methods
  *
  * @param {Object} selectedNode selected node
  * @param {Object} classifyState classify state
  * @param {Object} responseState response state
  * @param {Object} data data in the viewModel
  * @param {Object} workspaceObjectUid workspace object uid
*/
export let detectNodeType = function( selectedNode, classifyState, responseState, data, workspaceObjectUid ) {
    data.panelMode = classifyState.value.panelMode;
    data.attr_anno = null;
    data.origAttr_anno = null;
    data.imageURLs = null;
    data.viewerData = null;
    data.isAlreadyPrompted = false;
    data.attributesVisible = false;
    data.clsImgAvailable = false;
    data.selectedClass = selectedNode;
    data.updateInstances = null;

    if ( data.propGroupFilter ) {
        data.propGroupFilter.dbValue = '';
    }
    data.searchResults = null;

    if ( selectedNode ) {
        //If we need to prepare the properties field, do that. Otherwise just skip to updating classify state.
        if( selectedNode.type === 'StorageClass' ) {
            if( classifyState.value.editClassUID === classifyDefinesService.NULL_UID ) {
                exports.getAttributes( data, classifyState, responseState, workspaceObjectUid );
            } else {
                if( classifyState.value.editClassCmd && ( selectedNode.id === classifyState.value.editClassCmd.targetClassID || classifyState.value.editClassCmd.alreadyShownEditClassAttr ) ) {
                    exports.getAttributes( data, classifyState, responseState, classifyState.value.editClassUID );
                } else {
                    exports.updateClassifyStateAttrs( classifyState, data );
                }
            }
        } else if( selectedNode.childCount === 0 ) {
            messagingService.reportNotyMessage( data, data._internal.messages, 'nonStorageClassMessage' );
            exports.updateClassifyStateAttrs( classifyState, data );
        } else {
            exports.updateClassifyStateAttrs( classifyState, data );
        }
    }
};

export default exports = {
    detectNodeType,
    formatDataAndResponse,
    getAttributes,
    getAttributesForPaste,
    getNodeData,
    updateClassifyStateAttrs
};
