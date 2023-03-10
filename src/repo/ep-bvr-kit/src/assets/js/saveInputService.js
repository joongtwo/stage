// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/saveInputService
 */

import { constants as epSaveConstants } from 'js/epSaveConstants';
import epSessionService from 'js/epSessionService';
import _ from 'lodash';

export default class SaveInput {
    constructor() {
        this.sections = {};
        this.relatedObjects = {};
        this.prepareNameToValuesMap = prepareNameToValuesMap.bind( this );
    }

    addEntryToSection( sectionName, entry ) {
        let section = this.sections[ sectionName ];
        if( !section ) {
            section = {
                sectionName: sectionName,
                dataEntries: []
            };
            this.sections[ sectionName ] = section;
        }

        section.dataEntries.push( { entry } );
    }

    getSection( sectionName ) {
        return this.sections[ sectionName ];
    }

    addAlternativeInput( object, inputObj, ALTERNATIVE_UID ) { // do we need to check is there already a entry for this objectid?
        if( object ) {
            const entry = {};
            entry.Object = this.prepareNameToValuesMap( {
                alternativeCCClientID: ALTERNATIVE_UID,
                sourceId: object.uid,
                altPlBOPName: inputObj.newPlantBOPName,
                openOnCreate: inputObj.isPartial.toString(),
                cloneAlternative: inputObj.cloneAlternative.toString()
            } );
            entry.AlternativeProps = this.prepareNameToValuesMap( {
                altCCName: inputObj.newPackageName,
                description: inputObj.newDescription
            } );

            this.addEntryToSection( epSaveConstants.CREATE_ALTERNATIVE, entry );
        }
    }

    addSessionInformation( performCheck ) {
        this.sections[ epSaveConstants.SESSION ] = epSessionService.getSessionSection( performCheck );
    }

    addRelatedObjects( objects ) {
        _.forEach( objects, object => {
            this.relatedObjects[ object.uid ] = {

                uid: object.uid,
                type: object.type
            };
        } );
    }

    addAsyncMode( async ) {
        let parameters = this.parameters;
        if( !parameters ) {
            parameters = {};
            this.parameters = parameters;
        }
        if( async ) {
            parameters.AsyncMode = [ 'true' ];
        }
    }

    addReloadSection( loadInput ) {
        if( loadInput && loadInput.dataEntries ) {
            this.sections[ epSaveConstants.RELOAD ] = {
                sectionName: epSaveConstants.RELOAD,
                dataEntries: loadInput.dataEntries
            };
        }
    }

    //TODO : This function is deprecated and should be removed from next version
    //addReloadSection function should be called instead.
    addReloadSectionWithObject( loadType, objToLoad ) {
        const entry = {
            typeToLoad: prepareNameToValuesMap( loadType ),
            objectToLoad: prepareNameToValuesMap( objToLoad )
        };
        this.addEntryToSection( epSaveConstants.RELOAD, entry );
    }

    addReviseInput( reviseObject ) {
        if( reviseObject ) {
            const entry = {
                Object: prepareNameToValuesMap( {
                    id: reviseObject.uid
                } )
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_REVISE, entry );
        }
    }

    addTimeUnit( timeUnitId ) {
        if( timeUnitId ) {
            const entry = {
                [ epSaveConstants.TIME_UNITS ]: prepareNameToValuesMap( { id: timeUnitId } )
            };
            this.addEntryToSection( epSaveConstants.TIME_UNITS, entry );
            this.addIgnoreReadOnlyMode();
        }
    }

    addIgnoreReadOnlyMode() {
        this.ignoreReadOnlyMode = true;
    }

    addReportInput( reportObject ) {
        if( reportObject ) {
            const entry = {
                Object: prepareNameToValuesMap( reportObject )
            };
            this.addEntryToSection( epSaveConstants.CREATE_REPORT, entry );
        }
    }

    addDeleteObject( delObject ) {
        if( delObject ) {
            const entry = {
                Object: prepareNameToValuesMap( delObject )
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_DELETE, entry );
        }
    }

    addMoveObject( moveObject, parentObject ) { // do we need to check is there already a entry for this objectid?
        const entry = {};
        if( moveObject ) {
            entry.Object = prepareNameToValuesMap( moveObject );
        }
        if( parentObject ) {
            entry.RefProp = prepareNameToValuesMap( parentObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    addAssignedTools( object, toolsAddObject, toolsRemObject ) { // do we need to check is there already a entry for this objectid?
        const entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( toolsAddObject ) {
            entry.AssignedTools = prepareNameToValuesMap( toolsAddObject );
        }
        if( toolsRemObject ) {
            entry.AssignedTools = prepareNameToValuesMap( toolsRemObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    addRemoveOrAddObjects( actionType, objectUid, objectsList, entryName, relationType ) {
        const entry = {};
        if( objectUid ) {
            entry.Object = prepareNameToValuesMap( {
                id: [ objectUid ]
            } );
        }
        if( objectsList ) {
            entry[ entryName ] = {
                nameToValuesMap: {}
            };
            entry[ entryName ].nameToValuesMap[ actionType ] = objectsList;
            if( relationType ) {
                entry[ entryName ].nameToValuesMap.relationType = [ relationType ];
            } else {
                entry[ entryName ].nameToValuesMap.useDefaultRelationType = [ 'true' ];
            }
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }
    addGenerateStructureInput( sourceObjectUid ) {
        const entry = {};
        entry.Object = this.prepareNameToValuesMap( {
            sourceCCId: sourceObjectUid
        } );

        this.addEntryToSection( epSaveConstants.RULE_STREAM_GENERATION, entry );
    }
    addCloneObject( object ) {
        if( object ) {
            const entry = {
                Object: prepareNameToValuesMap( object )
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_CLONE, entry );
        }
    }
    addSyncObject( object ) {
        if( object ) {
            const entry = {
                syncTwin: prepareNameToValuesMap( object )
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
        }
    }
    addPredecessor( predecessorInfo, isFlowInput = 'false' ) {
        if( predecessorInfo ) {
            const successorObjMap = prepareNameToValuesMap( {
                id: predecessorInfo.objectId
            } );
            const predecessorObjMap = prepareNameToValuesMap( {
                Add: predecessorInfo.predecessorId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: successorObjMap,
                Predecessors: predecessorObjMap
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
        }
    }

    addSuccessor( successorInfo, isFlowInput = 'false' ) {
        if( successorInfo ) {
            const objMap = prepareNameToValuesMap( {
                id: successorInfo.objectId
            } );

            const predMap = prepareNameToValuesMap( {
                Add: successorInfo.successorId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: objMap,
                Successors: predMap
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
        }
    }

    deleteFlow( flowObject, isFlowInput = 'false' ) {
        if( flowObject ) {
            const successorObjMap = prepareNameToValuesMap( {
                id: flowObject.toId
            } );
            const predecessorObjMap = prepareNameToValuesMap( {
                Remove: flowObject.fromId,
                isFlowInput: isFlowInput
            } );
            const entry = {
                Object: successorObjMap,
                Predecessors: predecessorObjMap
            };
            this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
        }
    }

    addUpdateWorkInstructions( objectID, bodyTextProp, epwBodyTextProp, datasetsToAdd, addStxElement ) {
        let entry = {};

        if( objectID ) {
            entry.Object = prepareNameToValuesMap( {
                id: [ objectID ]
            } );
        }
        const nameToValuesMap = {
            DatasetID: epSaveConstants.DATASET_ID,
            body_text: bodyTextProp,
            epw0body_text2: epwBodyTextProp
        };
        if( datasetsToAdd ) {
            nameToValuesMap.Add = datasetsToAdd;
        }

        if( addStxElement && addStxElement.length > 0 ) {
            nameToValuesMap.addStxElement = addStxElement;
        }

        entry.WIData = prepareNameToValuesMap( nameToValuesMap );

        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    addModifiedProperty( objectId, propertyName, propertyValues ) {
        const modifySection = this.getSection( epSaveConstants.OBJECTS_TO_MODIFY );

        if( modifySection && modifySection.dataEntries.length > 0 ) {
            for( let i = 0; i < modifySection.dataEntries.length; ++i ) {
                if( modifySection.dataEntries[ i ].entry.Object.nameToValuesMap.id[ 0 ] === objectId ) {
                    if( propertyValues ) {
                        if( modifySection.dataEntries[ i ].entry.Prop ) {
                            modifySection.dataEntries[ i ].entry.Prop.nameToValuesMap[ propertyName ] = propertyValues;
                            return;
                        }

                        const propData = prepareNameToValuesMap( {} );
                        propData.nameToValuesMap[ propertyName ] = propertyValues;
                        modifySection.dataEntries[ i ].entry.Prop = propData;
                        return;
                    }
                    modifySection.dataEntries[ i ].entry.Prop.nameToValuesMap[ propertyName ] = [ '' ];
                    return;
                }
            }
        }

        const propData = prepareNameToValuesMap( {} );
        propData.nameToValuesMap[ propertyName ] = propertyValues ? convertToStringIfNeeded( propertyValues ) : '';

        const entry = {
            Object: prepareNameToValuesMap( {
                id: objectId
            } ),
            Prop: propData
        };
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    addCreateObject( objectMap, propMap ) {
        let entry = {};
        if( objectMap ) {
            entry.Object = prepareNameToValuesMap( objectMap );
        }
        if( propMap.itemPropMap ) {
            entry.ItemProps = prepareNameToValuesMap( propMap.itemPropMap );
        }
        if( propMap.revPropMap ) {
            entry.RevProps = prepareNameToValuesMap( propMap.revPropMap );
        }
        if( propMap.morePropMap ) {
            _.forOwn( propMap.morePropMap, function( value, key ) {
                entry.Object.nameToValuesMap[ key ] = [ value ];
            } );
        }
        if( propMap.additionalPropMap ) {
            entry.AdditionalProps = prepareNameToValuesMap( propMap.additionalPropMap );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_CREATE, entry );
    }
    /**
     * @param {Object} object
     * @param {AssignedParts} partsAddObject and partsRemObject
     */

    addAssignedParts( object, partsAddObject, partsRemObject ) {
        let entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( partsAddObject ) {
            entry.AssignedParts = prepareNameToValuesMap( partsAddObject );
        }
        if( partsRemObject ) {
            entry.AssignedParts = prepareNameToValuesMap( partsRemObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param {Object} object structure to add to CC
     * @param {Object} objectToAdd input for ConnectedStructures
     */
    addObjectToCC( object, objectToAdd ) {
        let entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( objectToAdd ) {
            entry.ConnectedStructures = prepareNameToValuesMap( objectToAdd );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param {Object} object
     * @param {Object} objectToRemove input for ConnectedStructures
     */
    removeObjectFromCC( object, objectToRemove ) {
        let entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( objectToRemove ) {
            entry.ConnectedStructures = prepareNameToValuesMap( objectToRemove );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * Add Configurator Context to workpackage
     * @param {*} object
     * @param {*} configContextObject
     */
    addConfiguratorContext( object, configContextObject ) {
        let entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( configContextObject ) {
            entry.ConfiguratorContext = prepareNameToValuesMap( configContextObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * Remove Configurator Context from workpackage
     * @param {*} object
     * @param {*} configContextObject
     */
    removeConfiguratorContext( object, configContextObject ) {
        let entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( configContextObject ) {
            entry.ConfiguratorContext = prepareNameToValuesMap( configContextObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * array of variant formula data
     * @param { Array } variantFormulaData each object represents a model object with it's variant selection
     */
    addVariantFormula( variantFormulaData ) {
        if( variantFormulaData ) {
            _.forEach( variantFormulaData, data => {
                const entry = {
                    Object: prepareNameToValuesMap( {
                        id: data.uid
                    } ),
                    VariantFormulaInput: prepareNameToValuesMap( data.expression )
                };
                this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
            } );
        }
    }

    /**
     * @param { Object } occurrenceEffectivityObj occurence effectivity object
     */
    saveOccurrenceEffectivity( occurrenceEffectivityObj ) {
        let entry = {};
        entry.Object = prepareNameToValuesMap( {
            id: [ occurrenceEffectivityObj.objectUID ]
        } );
        let nameToValuesMap = {
            action: occurrenceEffectivityObj.actionType,
            id: occurrenceEffectivityObj.unitObjectID,
            unit: occurrenceEffectivityObj.unit,
            endItem: occurrenceEffectivityObj.endItem
        };
        entry.OccurrenceEffectivity = prepareNameToValuesMap( nameToValuesMap );
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }
    /**
     *
     * @param {Object} regenerateFindNumberInputObj
     */
    regenerateFindNumber( regenerateFindNumberInputObj ) {
        let entry = {};
        entry.Object = prepareNameToValuesMap( {
            id: [ regenerateFindNumberInputObj.objectUid ]
        } );
        let nameToValuesMap = {
            startNumber: regenerateFindNumberInputObj.startNumber,
            increment: regenerateFindNumberInputObj.increment,
            isRecursive: regenerateFindNumberInputObj.isRecursive,
            isBasedOnFlows: regenerateFindNumberInputObj.isBasedOnFlows,
            isKeepParallelFindNumber: regenerateFindNumberInputObj.isKeepParallelFindNumber
        };
        entry.RegenerateFindNumber = prepareNameToValuesMap( nameToValuesMap );
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     *
     * @param {Object} flowData
     */
    updateFlows( flowData ) {
        const entry = {
            Object: prepareNameToValuesMap( { id: flowData.objectUid } ),
            UpdateFlow: prepareNameToValuesMap( {
                Recursive: flowData.Recursive,
                ParallelFlowsAllowed: flowData.ParallelFlowsAllowed
            } )
        };
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param { Object } occurrenceEffectivityObj occurence effectivity object for Product view
     */
    saveOccurrenceEffectivityForProductView( occurrenceEffectivityObj, scopeObj ) {
        let entry = {};
        entry.Object = prepareNameToValuesMap( {
            id: [ occurrenceEffectivityObj.objectUID ]
        } );
        let nameToValuesMap = {
            action: occurrenceEffectivityObj.actionType,
            name: occurrenceEffectivityObj.unitObjectID,
            unit: occurrenceEffectivityObj.unit,
            endItem: occurrenceEffectivityObj.endItem
        };
        entry.ProductViewEffectivityScope = prepareNameToValuesMap( {
            id: [ scopeObj.uid ]
        } );
        entry.OccurrenceEffectivity = prepareNameToValuesMap( nameToValuesMap );
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * Edit or Remove effectivity from product view
     * @param {*} occurrenceEffectivityObj
     * @param {*} scopeObj
     */
    editOrRemoveOccurrenceEffectivityForProductView( occurrenceEffectivityObj, productView, scopeObj ) {
        let entry = {};
        entry.Object = prepareNameToValuesMap( {
            id: [ productView.uid ]
        } );
        let nameToValuesMap = {
            action: occurrenceEffectivityObj.actionType,
            unit: occurrenceEffectivityObj.unit,
            endItem: occurrenceEffectivityObj.endItem,
            id: occurrenceEffectivityObj.unitObjectID
        };
        entry.ProductViewEffectivityScope = prepareNameToValuesMap( {
            id: [ scopeObj.uid ]
        } );
        entry.OccurrenceEffectivity = prepareNameToValuesMap( nameToValuesMap );
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param workflowObject
     */

    addWorkflowInput( workflowObject ) {
        if( workflowObject ) {
            const entry = {
                Prop: prepareNameToValuesMap( workflowObject )
            };
            this.addEntryToSection( epSaveConstants.CREATE_WORKFLOW, entry );
        }
    }
    /**
     * @param { Object } context the target of the assigned PMIs
     * @param { objectsList } pmiListToAdd - The PMI list to be assigned to the context (Inspection Def is created for each PMI which connected to te PMI itself).
     * @param {objectsList }  pmiListToRemove - The inspections to be removed from the context.
     */
    addRemoveAssignedPMIs( context, pmiListToAdd, pmiListToRemove ) {
        const entry = {
            Object: prepareNameToValuesMap( { id: [ context.uid ] } )
        };
        pmiListToAdd && ( entry.AssignedPMIs = prepareNameToValuesMap( { Add: pmiListToAdd } ) );
        if( Array.isArray( pmiListToRemove ) && pmiListToRemove.length > 0 ) {
            const inspectionRevisionUid = [];
            const configuration = [];
            pmiListToRemove.forEach( inspectionRevision => {
                inspectionRevisionUid.push( inspectionRevision.uid );
                let configurationProp = inspectionRevision.props[ epSaveConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP ];
                configurationProp = configurationProp ? !configurationProp.dbValue : true;
                configuration.push( configurationProp.toString() );
            } );
            entry.AssignedPMIs = prepareNameToValuesMap( { Remove: inspectionRevisionUid, Configuration: configuration } );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     *
     * @param {Object} context the target of the assigned PMIs
     * @param {objectsList} pmiUpdateList The assigned PMI list for update
     * @param {objectsList} pmiUpdateToList The update to PMI list
     */
    updateAssignedPMIs( context, pmiUpdateList, pmiUpdateToList ) {
        const entry = {};
        if( context && pmiUpdateList && pmiUpdateToList ) {
            entry.Object = prepareNameToValuesMap( { id: [ context.uid ] } );
            entry.AssignedPMIs = prepareNameToValuesMap( {
                Update: pmiUpdateList,
                Characteristic: pmiUpdateToList
            } );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param { Object } sourceObject the process object to create the relation with
     * @param { Object } targetObject - The target mbom assembly object
     */
    associateWIToAssembly( sourceObject, targetObject ) {
        const entry = {};
        if( sourceObject ) {
            entry.Object = prepareNameToValuesMap( sourceObject );
        }
        if( targetObject ) {
            entry.WIAssociateTargetAssembly = prepareNameToValuesMap( targetObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param { Object } sourceObject top line uid
     * @param { Object } targetObject - ConfigurationChange object
     */
    addConfigurationChangeEntry( sourceObject, targetObject ) {
        const entry = {};
        if( sourceObject ) {
            entry.Object = prepareNameToValuesMap( sourceObject );
        }
        if( targetObject ) {
            entry.ConfigurationChange = prepareNameToValuesMap( targetObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
        this.addIgnoreReadOnlyMode();
    }

    /**
     *
     * @param { Object } process context process
     * @param { Object } activities list of activities
     */
    closeAttachmentWindows( process, activities ) {
        const entry = {};
        entry.Object = prepareNameToValuesMap( process );
        entry.CloseAttachmentWindows = prepareNameToValuesMap( activities );
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }
    /**
     * @param { Object } sourceObject top object
     * @param { Object } targetObject - packall/unpackall object
     */
    addPackAllUnpackAllChangeEntry( sourceObject, targetObject ) {
        const entry = {};
        if( sourceObject ) {
            entry.Object = prepareNameToValuesMap( sourceObject );
        }
        if( targetObject ) {
            entry.PackUnpackWindow = prepareNameToValuesMap( targetObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, entry );
    }

    /**
     * @param {Object} object
     * @param {Prop} propObject
     */

    addInstantiateObject( object, propObject ) {
        const entry = {};
        if( object ) {
            entry.Object = prepareNameToValuesMap( object );
        }
        if( propObject ) {
            entry.Prop = prepareNameToValuesMap( propObject );
        }
        this.addEntryToSection( epSaveConstants.OBJECT_TO_INSTANTIATE, entry );
    }
}
/**
 * @param { Object } properties properties
 * @returns { Object } nameValueMap
 */
function prepareNameToValuesMap( properties ) {
    const nameToValuesMap = {};

    _.forOwn( properties, function( value, key ) {
        if( Array.isArray( value ) ) {
            nameToValuesMap[ key ] = value;
        } else {
            nameToValuesMap[ key ] = [ value ];
        }
    } );
    return { nameToValuesMap };
}

/**
 *
 * @param {Object[]} propertyValues - array to convert
 * @returns {Object[]} - converted array to include only string
 */
function convertToStringIfNeeded( propertyValues ) {
    return _.map( propertyValues, val => isNaN( val ) ? val : val.toString() );
}
