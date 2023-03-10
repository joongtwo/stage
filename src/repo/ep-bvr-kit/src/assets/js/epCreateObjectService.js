// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * create object service for EasyPlan.
 *
 * @module js/epCreateObjectService
 */

import 'soa/preferenceService';
import 'soa/kernel/clientDataModel';
import 'js/addObjectUtils';
import clientMetaModel from 'soa/kernel/clientMetaModel';
import soaService from 'soa/kernel/soaService';
import dmService from 'soa/dataManagementService';
import preferenceSvc from 'soa/preferenceService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import appCtxService from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import epBvrObjectService from 'js/epBvrObjectService';
import epReloadService from 'js/epReloadService';
import addObjectUtils from 'js/addObjectUtils';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';


const createTypePrefNamePrefix = 'EP_CreateSubtypesForType_';

/**
 * This method returns the type of object to be created based on preference
 * @param { String } objectBaseType - Object base type
 * @param { StringArray } subTypeExclusionList - Exclusion list
 * @param { String } preferenceName - preferenceName
  for BO types
 * @return {Object} the type list
 */
export function ensureCreateObjectTypesLoadedJs( objectBaseType, subTypeExclusionList, preferenceName ) {
    let prefName = createTypePrefNamePrefix + objectBaseType;
    if( preferenceName ) {
        prefName = preferenceName;
    }
    const prefNames = [ prefName ];
    return preferenceSvc.getStringValues( prefNames )
        .then(
            function( values ) {
                return values && values.length > 0 && values[ 0 ] !== null ? getAvailableModelTypes( objectBaseType, values, subTypeExclusionList ) :
                    getDefaultAvailableModelTypes( objectBaseType, subTypeExclusionList );
            } );
}

/**
 *
 * @param {OBJECT} results fetched types
 * @returns {STRING} stringed all types with ','
 */
export function convertToString( results ) {
    let conversion = '';
    results.forEach( data => conversion += data.name + ',' );
    return conversion.slice( 0, -1 );
}

/**
 * This method returns the available type based on preference values
 * @param { String } objectBaseType - Object Base Type
 * @param { StringArray } values - Value of the preference
 * @param { StringArray } subTypeExclusionList - Exclusion list
 * @return {StringArray} - List of type value strings
 */
function getAvailableModelTypes( objectBaseType, values, subTypeExclusionList ) {
    return soaService.ensureModelTypesLoaded( values )
        .then( () => {
            let typesListInfo = [];

            values.map( val => {
                const modelType = clientMetaModel.getType( val );
                modelType && modelType.typeHierarchyArray.includes( objectBaseType ) && typesListInfo.push( modelType );
            } );

            let typeList = [];
            const filteredModelTypes = filterModelTypes( typesListInfo, subTypeExclusionList );
            for( const filteredType of filteredModelTypes ) {
                typeList.push( filteredType.uid );
            }
            return dmService.loadObjects( typeList ).then( () => {
                return {
                    searchResults: filteredModelTypes,
                    totalFound: filteredModelTypes.length
                };
            } );
        } );
}

/**
 * This method returns the available type based on object type
 * @param { String } objectBaseType - Object base type
 * @param { StringArray } subTypeExclusionList - Exclusion list
 * @return { StringArray } - List of type value strings
 */
function getDefaultAvailableModelTypes( objectBaseType, subTypeExclusionList ) {
    let findBoDisplayableNamesSoaInputs = [];
    let typesList = [];

    let findBoDisplayableNamesInputObject = {};
    findBoDisplayableNamesInputObject.boTypeName = objectBaseType;
    findBoDisplayableNamesInputObject.exclusionBOTypeNames = subTypeExclusionList;

    findBoDisplayableNamesSoaInputs.push( findBoDisplayableNamesInputObject );

    let inputData = {};
    inputData.input = findBoDisplayableNamesSoaInputs;

    return soaService.postUnchecked( 'Core-2010-04-DataManagement', 'findDisplayableSubBusinessObjectsWithDisplayNames', inputData )
        .then( function( result ) {
            result.output && result.output.forEach( out => {
                out.displayableBOTypeNames && out.displayableBOTypeNames.forEach( typeInfo => {
                    typesList.push( typeInfo.boName );
                } );
            } );
            return getAvailableModelTypes( objectBaseType, typesList );
        } );
}

/**
 * Filter the type list
 *
 * @param {ObjectArray} typeListInfo - Type list object Array
 * @param {StringArray} subTypeExclusionList - List of exclusion strings
 * @returns {String } filtered array
 */
function filterModelTypes( typeListInfo, subTypeExclusionList ) {
    let filteredTypeList = [];
    if( subTypeExclusionList && subTypeExclusionList.length > 0 && typeListInfo && typeListInfo.length > 0 ) {
        filteredTypeList = typeListInfo.map( type => {
            let typeHierarchy = [];
            typeHierarchy = type.typeHierarchyArray;

            const typeFoundInExclusion = subTypeExclusionList.findIndex( ( modelType ) => { typeHierarchy.includes( modelType ); } );

            if( typeFoundInExclusion ) {
                return type;
            }
        } );
    } else {
        filteredTypeList = typeListInfo;
    }
    return filteredTypeList;
}
/**
 *
 * @param {OBJECT} results fetched types
 * @returns {STRING} string type
 */
export function splitTypeString( results ) {
    return convertToString( results ).split( ',' )[0];
}
/**
 *
 * Clear selected type when user click on type link on create form
 *
 */
export function clearSelectedType() {
    const selectedType = '';
    eventBus.publish( 'initializeGetCreatableObjectTypesDataProvider' );
    eventBus.publish( 'epCreateObject.assignProjects', { selectedProjects: [] } );
    return selectedType;
}

/**
 * When user select type from type selection panel of create we need to navigate to create form. This method
 * will set few variable to hide type selector panel and to show create form.
 * @param {Object} data - The panel's view model object
 */
export function handleTypeSelectionJs( data ) {
    let selectedType = data.dataProviders.getCreatableObjectTypes.selectedObjects;
    data.selectedType.dbValue = '';
    if( selectedType && selectedType.length > 0 ) {
        data.selectedType.dbValue = selectedType[ 0 ].props.type_name.dbValue;
        let vmProperty = uwPropertyService.createViewModelProperty( selectedType[ 0 ].props.object_string.dbValue,
            selectedType[ 0 ].props.object_string.dbValue, 'STRING', '', '' );
        data.displayedType.dbValue = vmProperty.propertyDisplayName;
    }
}

/**
 * Register the policy
 *
 * @return {Object}  null
 */
function registerPolicy() {
    const createObjectPolicy = {
        types: [ {
            name: 'ImanItemBOPLine',
            properties: [ {
                name: epBvrConstants.BL_ITEM
            },
            {
                name: epBvrConstants.BL_PARENT
            },
            {
                name: epBvrConstants.BL_SEQUENCE_NO
            },
            {
                name: epBvrConstants.MFG_SUB_ELEMENTS
            }
            ]
        },
        {
            name: epBvrConstants.MFG_PROCESS_STATION,
            properties: [ {
                name: epBvrConstants.MFG_ALLOCATED_OPS
            } ]
        }
        ]

    };
    return propPolicySvc.register( createObjectPolicy );
}

/**
 *
 * @param {Object} data viewmodelData
 * @param {Object} creationType details of selected type
 * @returns {Object} propertiesMap
 */
function getItemOrRevisionProperties( data, creationType, editHandler ) {
    const propertiesMap = new Object();
    let createInput;

    if ( creationType.props.type_name ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( creationType.props.type_name.dbValues[0], editHandler );
        createInput = addObjectUtils.getCreateInput( data, null, creationType.props.type_name.dbValues[0], editHandler );
    } else {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.dataProviders.getCreatableObjectTypes.selectedObjects[ 0 ].props.type_name, editHandler  );
        createInput = addObjectUtils.getCreateInput( data, null, data.dataProviders.getCreatableObjectTypes.selectedObjects[ 0 ].props.type_name, editHandler );
    }


    const itemProperties = createInput[ 0 ].createData.propertyNameValues;
    const revisionProperties = createInput[ 0 ].createData.compoundCreateInput.revision ? createInput[ 0 ].createData.compoundCreateInput.revision[ 0 ].propertyNameValues : null;
    itemProperties && ( propertiesMap.itemPropMap = itemProperties );
    revisionProperties && ( propertiesMap.revPropMap = revisionProperties );
    return propertiesMap;
}

/**
 * Calls the save service to create the object.
 * @param {Object} data - The panel's view model object
 * @param { Object } connectedTo - The object to connect
 * @param { String } policyId - policy Id
 * @param { Object } workPackage - workPackage
 * @param { Object } predecessor - predecessor object
 * @param { boolean } isResequenceNeeded - flag to check resequencing of objects
 * @param { Object } targetAssembly - target assembly to connect to
 */
export function createObject( viewModelData, connectedTo, policyId, workPackage, newObjectId, predecessor, isResequenceNeeded, targetAssembly, creationType ) {
    let relModelObject;
    let relatedObjects;
    const data = viewModelData.getData();
    const object = {
        id: newObjectId,
        Type: null
    };
    if( creationType.props.type_name ) {
        object.Type = creationType.props.type_name.dbValues[0];
    } else{
        object.Type = data.dataProviders.getCreatableObjectTypes.selectedObjects[0].props.type_name.dbValue;
    }
    if( connectedTo ) {
        object.connectTo = connectedTo.uid;
        relModelObject = {
            uid: connectedTo.uid,
            type: connectedTo.type
        };
        relatedObjects = [ relModelObject ];
    }
    const propertiesMap = getItemOrRevisionProperties( data, creationType );
    policyId.dbValue = registerPolicy();
    const saveWriter = saveInputWriterService.get();
    saveWriter.addCreateObject( object, propertiesMap );

    // Add resequence modify section
    //TODO :Resquencing of operations should be handled from server.Once that is done , this section should be removed.

    if( predecessor ) {
        if( typeof predecessor === 'string' ) {
            predecessor = JSON.parse( predecessor )[ 0 ];
        }
        const resequencedChildren = connectedTo && connectedTo.uid !== predecessor.uid && isResequenceNeeded && addObjectsToResequence( predecessor, connectedTo, object, saveWriter );
        relatedObjects = resequencedChildren ? relatedObjects.concat( resequencedChildren ) : relatedObjects;
    }
    if( workPackage ) {
        const ccObject = {
            id: [ workPackage ]
        };
        const objectToAddInCC = {
            Add: [ object.id ],
            revisionRule: [ appCtxService.ctx.userSession.props.awp0RevRule.value ]
        };
        const ccModelObject = cdmSvc.getObject( workPackage );
        const revRuleObj = cdmSvc.getObject( appCtxService.ctx.userSession.props.awp0RevRule.value );
        if( relatedObjects ) {
            relatedObjects = [ ...relatedObjects, ccModelObject, revRuleObj ];
        } else {
            relatedObjects = [ ccModelObject, revRuleObj ];
        }
        saveWriter.addObjectToCC( ccObject, objectToAddInCC );
    }

    if( targetAssembly ) {
        const newObj = {
            id: newObjectId
        };

        const targetAsm = {
            targetObjects: targetAssembly.uid
        };

        relModelObject = {
            uid: targetAssembly.uid,
            type: targetAssembly.type
        };
        relatedObjects.push( relModelObject );

        saveWriter.associateWIToAssembly( newObj, targetAsm );
    }

    return epSaveService.saveChanges( saveWriter, true, relatedObjects ).then( function( serviceResponse ) {
        if( serviceResponse.saveEvents && serviceResponse.saveEvents.length > 0 ) {
            const childObjectsToAddUids = getNewObjectsUid( serviceResponse.saveEvents, epSaveConstants.CREATE_EVENT );
            const parentObjUid = serviceResponse.ServiceData.modelObjects[childObjectsToAddUids[0]].props.bl_parent.dbValues[0];
            epObjectPropertyCacheService.updateProperty( parentObjUid, epBvrConstants.RELATED_OBJECT_CHILDREN_KEY, childObjectsToAddUids );
        }
        Promise.resolve( serviceResponse );
    } );
}
/**
 * filter event data by type
 *
 * @param {Object} saveEvents - the save events as json object
 * @param {String} eventType - event Type
 * @returns {int} event
 */
function getNewObjectsUid( saveEvents, eventType ) {
    let newUids = [];
    saveEvents.map( event => {
        if( event.eventType === eventType ) {
            newUids.push( event.eventObjectUid );
        }
    } );
    return newUids;
}


/**
 *
 * @param {Object} before Paste before
 * @param {Object} parent Parent
 * @param {Object} newObj new object
 * @param {Object} saveWriter save writer object
 * @returns {Object} resquence data
 */
function addObjectsToResequence( before, parent, newObj, saveWriter ) {
    const children = epBvrObjectService.getSequencedChildren( parent, epBvrConstants.MFG_SUB_ELEMENTS );
    if( children && children.length > 0 ) {
        const index = children.findIndex( child => child.uid === before.uid );
        //Before object
        const beforeObject = children[ index ];
        let beforeObjectFindNo = beforeObject ? Number( beforeObject.props.bl_sequence_no.dbValues[ 0 ] ) : 0;

        //After object
        let afterObject = children[ index + 1 ];
        let afterObjectFindNo = afterObject ? Number( afterObject.props.bl_sequence_no.dbValues[ 0 ] ) : 0;

        let newObjectFindNo;
        if ( index === children.length - 1 ) {
            const base_Seq_no = Number( children[children.length - 1].props.bl_sequence_no.dbValues[0] );
            const seq_no_interval = 10;
            newObjectFindNo = Number( base_Seq_no + seq_no_interval );
        }else{
            //find the average of before and after object
            newObjectFindNo = ( beforeObjectFindNo + afterObjectFindNo ) / 2;
        }
        modifySequenceNumberProperty( newObj.id, newObjectFindNo, saveWriter );
    }
    return children;
}

function modifySequenceNumberProperty( objUid, seq_no, saveWriter ) {
    const seqArray = new Array( String( seq_no ) );
    saveWriter.addModifiedProperty( objUid, epBvrConstants.BL_SEQUENCE_NO, seqArray );
}

export function generateObjectToAssign( viewModelData ) {
    const data = viewModelData.getData();
    if( data.saveResults && data.saveEvents.length > 0 ) {
        const creaedObjectUId = data.saveResults[ 1 ].saveResultObject.uid;
        let uid;
        data.saveEvents.forEach( saveEvents => {
            if( saveEvents.eventType === 'modifyPrimitiveProperties' && saveEvents.eventData[ 0 ] === 'bl_item' ) {
                uid = saveEvents.eventData[ 1 ];
            }
        } );
        return {
            type: data.ServiceData.modelObjects[ creaedObjectUId ].type,
            uid: uid
        };
    }
}

function filterProjectList( filterString, projectList ) {
    let filteredProjectCCs = [];
    let projectNamesMap = {};
    if( filterString.length > 0 ) {
        const projectCCNames = projectList.map( cc => {
            const ccName = cc.props.object_string.dbValues[ 0 ];
            projectNamesMap[ ccName ] = cc;
            return ccName;
        } );

        const filteredProjectNames = projectCCNames.filter( element => {
            return element.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1;
        } );

        filteredProjectCCs = filteredProjectNames.map( ccName => projectNamesMap[ ccName ] );
    }
    return filteredProjectCCs[ 0 ];
}
export function showAssignedProject( availableProject, selectedProject ) {
    const assignedProjects = selectedProject.map( element => filterProjectList( element.cellHeader1, availableProject ) );

    eventBus.publish( 'epCreateObject.assignProjects', { selectedProjects: assignedProjects } );
}
export function removeSelectedProject( projectToRemove, projectList ) {
    projectList = projectList.assignedProjectList && projectList.assignedProjectList.dbValues ? projectList.assignedProjectList.dbValues : projectList;
    const projectArray = projectList.filter( project => projectToRemove.uid !== project.uid );
    eventBus.publish( 'epCreateObject.assignProjects', { selectedProjects: projectArray } );
}

export function registerForReloadSection( name, type, object ) {
    if( !type ) { return; }
    if( typeof type === 'string' ) {
        type = JSON.parse( type );
    }
    type = type.epCreate ? type.epCreate : type;
    epReloadService.registerReloadInput( name, type, object );
}


export default {
    ensureCreateObjectTypesLoadedJs,
    convertToString,
    clearSelectedType,
    handleTypeSelectionJs,
    createObject,
    showAssignedProject,
    registerForReloadSection,
    removeSelectedProject,
    generateObjectToAssign,
    splitTypeString
};
