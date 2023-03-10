// Copyright (c) 2022 Siemens

/**
 * @module js/ewiService
 */
import appCtxSvc from 'js/appCtxService';
import workinstrUtilsSvc from 'js/workinstrUtilsService';
import workinstrTableSvc from 'js/workinstrTableService';
import workinstrFmsSvc from 'js/workinstrFileTicketService';
import policySvc from 'soa/kernel/propertyPolicyService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import awTableSvc from 'js/awTableService';
import AwStateService from 'js/awStateService';
import adapterSvc from 'js/adapterService';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import cfgSvc from 'js/configurationService';
import selectionSvc from 'js/selection.service';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import $ from 'jquery';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import navigationSvc from 'js/navigationService';


/**
 * Cached file management service
 */

let _currentStep = null;
let _topLine = null;
let _workPackage = null;

/** Constant strings*/
const _TRUE = 'true';
const _HTML_PARA_WITH_WORKINSTR_STYLE = '<p class=\'aw-workinstr-instructionStyle\'>';
const _HTML_PARA_END = '</p>';
const NOT_FOUND = -1;

/**
 * Fetches the immediate parent of BOMLilne by "bl_parent" relationship.
 *
 * @param {IModelObject} modelObject - The modelObject to access.
 *
 * @returns {IModelObject} modelObject - The immediate parent of the given modelObject based on 'bl_parent' (or NULL
 *          if no parent found).
 */
export function getParentUid( modelObject ) {
    if( modelObject && modelObject.props ) {
        const props = modelObject.props;
        if( props.bl_parent && !_.isEmpty( props.bl_parent.dbValues ) && props.bl_parent.dbValues[ 0 ] !== '' ) {
            const uid = props.bl_parent.dbValues[ 0 ];
            if( clientDataModelSvc.isValidObjectUid( uid ) ) {
                return uid;
            }
        }
    }
    return null;
}

/**
 * Gets the root modelObject of a given modelObject
 *
 * @param {IModelObject} modelObject - The given modelObject to get its root modelObject
 *
 * @returns {IModelObject} modelObject - The root (topLine) modelObject
 */
export function getRootModelObject( modelObject ) {
    const parentUid = getParentUid( modelObject );
    if( parentUid !== null ) {
        const parentObj = clientDataModelSvc.getObject( parentUid );
        return getRootModelObject( parentObj );
    }
    return modelObject;
}

/**
 * Gets the immediate sub elements of a given modelObject
 *
 * @param {IModelObject} modelObject - The given modelObject to get its sub elements
 *
 * @returns {StringArray} subElementsIds - List of sub elements Ids
 */
export function getModelObjectSubElements( modelObject ) {
    let subElements;
    if( modelObject.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_PROCESS_STATION ) > NOT_FOUND ) {
        subElements = modelObject.props.Mfg0allocated_ops;
    } else if( modelObject.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_PROCESS_PARTITION ) > NOT_FOUND ) {
        subElements = modelObject.props.bl_occgrp_visible_lines;
    } else {
        subElements = modelObject.props.Mfg0sub_elements;
    }
    return subElements;
}

/**
 * Fetches the immediate children of BOMLilne by "Mfg0sub_elements" relationship
 *
 * @param {String} parentUid - The parent uid to get its sub elements
 *
 * @returns {IModelObject} searchResults - The list of children
 */
export function loadSubElements( parentUid ) {
    let childOccurrences = [];
    const parentObj = clientDataModelSvc.getObject( parentUid );
    const subElementsProp = getModelObjectSubElements( parentObj );
    if( subElementsProp ) {
        const childrenUids = subElementsProp.dbValues;
        _.forEach( childrenUids, function( childUid ) {
            const childModelObj = clientDataModelSvc.getObject( childUid );
            childOccurrences.push( childModelObj );
        } );

        return awTableSvc.createListLoadResult( parentUid, childOccurrences, childOccurrences.length, 0, parentUid );
    }
}

/**
 * Navigates to the object with the given uid
 *
 * @param{string} selectedUid - the selected step uid to go to
 */
export function navigateToSelectedObject( selectedUid ) {
    if( selectedUid ) {
        const selectedObject = clientDataModelSvc.getObject( selectedUid );
        if( selectedObject.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_BVR_OPERATION ) === NOT_FOUND ) {
            if( selectedObject.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_PROCESS_STATION ) > NOT_FOUND ) {
                const ctxCurrentStep = appCtxSvc.getCtx( 'EWI0currentStep' );
                if( ctxCurrentStep.props.bl_parent && ctxCurrentStep.props.bl_parent.dbValues[ 0 ] !== selectedUid ) {
                    AwStateService.instance.params.resource = '';
                }
            } else {
                AwStateService.instance.params.resource = '';
            }
        }

        const action = {
            actionType: 'Navigate',
            navigateTo: AwStateService.instance.current.name
        };
        const navigationParams = {
            uid: AwStateService.instance.params.uid,
            stepUid: selectedUid,
            page: 'EWI',
            resource: ''
        };
        return navigationSvc.navigate( action, navigationParams ).then( () => {
            // Update the screen
            eventBus.publish( 'ewi.loadStep' );
        } );
    }
}

/**
 * Get the layout from preference but if in narrow mode then set singlePanelLayout ComputeLayout,
 * get the layout changed flag along with the updated workareasTabsData
 *
 * @param{string} preferenceLayout - the layout name from preference
 * @param{string} layoutName - the layout name from data
 * @param {ObjectArray} workareasTabsData - ewi sublocation workareas tabs data
 *
 * @return {string} currentLayoutName - if narrow mode then return singlePanelLayout otherwise, return the layout name from preference.
 * @return {string} isLayoutChanged - boolean value if resizing has causes any layout changes.
 * @return {ObjectArray} workareasTabsData - the updated ewi sublocation workareas tabs
 */
export function computeLayoutAndGetUpdatedWorkareasTabsData( preferenceLayout, layoutName, workareasTabsData ) {
    appCtxSvc.registerCtx( 'EWI0WindowSize', window.innerWidth );
    let currentLayoutName = window.innerWidth <= 650 ? 'SinglePanelLayout' : preferenceLayout;

    let isLayoutChanged = currentLayoutName !== layoutName;

    let updatedWorkareasTabsData =  isLayoutChanged === true ? null : workareasTabsData;

    return { currentLayoutName, isLayoutChanged, updatedWorkareasTabsData };
}

/**
 * Get the boolean value for loadHeaderProperties of loadWorkPackageDataConfigured SOA
 * When CC or one of the url params is different the loadHeaderProperties should be true
 * If it’s the same CC but different step then it should be false
 *
 * @param {Json} data - ewi data
 *
 * @return {boolean} shouldReloadHeaderProps - should loadHeaderProperties in loadWorkPackageDataConfigured SOA
 */
export function shouldReloadProps( data ) {
    let shouldReloadHeaderProps = true;
    const stateCtx = appCtxSvc.getCtx( 'state' );
    const ctxParams = stateCtx.params;
    if( ctxParams.preview === 'true' || ( data.resourceParam === ctxParams.resource || data.resourceParam === '' && ctxParams.resource === null ) &&
        ( data.endItemParam === ctxParams.enditem || data.endItemParam === '' && ctxParams.enditem === null ) &&
        ( data.unitNoParam === ctxParams.unitno || data.unitNoParam === '' && ctxParams.unitno === null ) &&
        ( data.dateParam === ctxParams.date || data.dateParam === '' && ctxParams.date === null ) &&
        ( data.revRuleParam === ctxParams.revrule || data.revRuleParam === '' && ctxParams.revrule === null ) &&
        data.workPackage && data.workPackage.uid === ctxParams.uid ) {
        shouldReloadHeaderProps = false;
    }

    return shouldReloadHeaderProps;
}

/**
 * Get "EWI_SinglePanelLayout" or "EWI_TwoPanelLayout" or "EWI_ThreePanelLayout" work areas tabs according to
 * preferences. The result would be something like: [0:[{name:Viewer, relations:[IMAN_3D_snap_shot:[],
 * IMAN_specification:["Image", "Bitmap", "GIF"]], viewMode:{name:gallery}, pageId:0}, {name:Document, relations:[] ,
 * viewMode:{name:gallery}, pageId:1}], 1:[...] ]
 *
 * Get all relations to load according to the tabs
 *
 * @param{string} layoutName - the layout preference name
 * @param{ObjectArray} executionPolicy - the needed execution policy
 * @param{ObjectArray} operatorSelectionPolicy - the needed operator selection policy
 *
 * @return {Object} viewsData - ewi sublocation workareas tabs views data
 */
export function getLayoutTabsFromPreference( layoutName, executionPolicy, operatorSelectionPolicy ) {
    const preferences = appCtxSvc.getCtx( 'preferences' );
    const executionEnabled = preferences.EWI_ExecutionEnabled && preferences.EWI_ExecutionEnabled[ 0 ] === _TRUE;

    let allPropPolicy = [];
    let policyIds = [];

    // Add execution policy
    if( executionEnabled === true && executionPolicy ) {
        registerExtraPolicies( executionPolicy, allPropPolicy, policyIds );

        const travelerPolicy = workinstrTableSvc.getColumnsPolicy( preferences.EWI_TableOverviewColumnShown, epBvrConstants.IMAN_ITEM_BOP_LINE );
        registerExtraPolicies( travelerPolicy, allPropPolicy, policyIds );
    }

    // Add operatorSelection policy
    if( preferences.EWI_ShowOperatorSelection[ 0 ] === 'true' && operatorSelectionPolicy ) {
        registerExtraPolicies( operatorSelectionPolicy, allPropPolicy, policyIds );
    }

    return cfgSvc.getCfg( 'workinstrViewModel' ).then( function( jsonData ) {
        jsonData._viewModelId = layoutName;
        const views = jsonData.views;
        const layoutTabs = workinstrUtilsSvc.parsePreferenceValues( preferences[ 'EWI_' + layoutName ] );
        let workareasTabs = [];
        let allRelationsToLoad = {};
        _.forEach( layoutTabs, function( layoutTab ) {
            const workareaName = layoutTab.relationName;
            const workareaTabNames = layoutTab.types;
            let workareaTabs = [];
            let tabIndex = 0;
            _.forEach( workareaTabNames, function( tabName ) {
                if( tabName !== 'DataCollection' || executionEnabled === true ) {
                    const tabData = views[ tabName ];
                    if( tabData ) {
                        let tabViewMode = {
                            name: tabData.viewMode
                        };
                        let tabRelationsToLoad = [];
                        let tabColumns = [];
                        let propPolicy = null;
                        if( tabData.viewMode === 'WorkinstrGallery' ) {
                            const relations = workinstrUtilsSvc.parsePreferenceValues( preferences[ tabData.configPreferenceName ] );
                            for( let currRelation in relations ) {
                                const relationName = relations[ currRelation ].relationName;
                                const relationTypes = relations[ currRelation ].types;
                                tabRelationsToLoad[ relationName ] = relationTypes;
                                workinstrUtilsSvc.addRelationToAllRelationsToLoad( allRelationsToLoad, relationName, relationTypes );
                                tabViewMode.showThumbnails = tabData.showThumbnails === 'false' ? 'false' : _TRUE;
                                tabViewMode.viewer = tabData.viewer;
                            }
                        } else if( tabData.tableView ) {
                            tabRelationsToLoad[ tabData.runtimePropertyName ] = [];
                            allRelationsToLoad[ tabData.runtimePropertyName ] = [];
                            propPolicy = workinstrTableSvc.getColumns( tabColumns,
                                preferences[ tabData.columnConfigPreferenceName ], tabData.typeName );

                            let extraPolicy = tabData.policy;
                            if( extraPolicy ) {
                                if( executionEnabled === true ) {
                                    if( tabName === 'Parts' ) {
                                        extraPolicy.types[ 0 ].properties.push( { name: preferences.EWI_PartIsLotProperty[ 0 ] } );
                                        extraPolicy.types[ 0 ].properties.push( { name: preferences.EWI_PartIsSerializedProperty[ 0 ] } );
                                    } else if( tabName === 'Tools' ) {
                                        extraPolicy.types[ 0 ].properties.push( { name: preferences.EWI_ToolIsLotProperty[ 0 ] } );
                                        extraPolicy.types[ 0 ].properties.push( { name: preferences.EWI_ToolIsSerializedProperty[ 0 ] } );
                                    }
                                }

                                propPolicy.types.push( extraPolicy.types[ 0 ] );
                            }

                            allPropPolicy.push( propPolicy );
                            const policyId = policySvc.register( propPolicy );
                            policyIds.push( policyId );

                            tabViewMode.columns = tabColumns;
                            tabViewMode.propPolicy = propPolicy;
                            tabViewMode.tableView = tabData.tableView;
                            tabViewMode.listView = tabData.listView;
                            tabViewMode.tableMode = 'table';
                        }

                        const resource = jsonData.i18n[ tabData.title ];
                        const localTextBundle = localeSvc.getLoadedText( resource[ 0 ] );
                        const newTab = {
                            viewId: tabName,
                            tabKey: tabName,
                            name: localTextBundle[ tabData.title ],
                            viewName: tabData.viewMode,
                            relations: tabRelationsToLoad,
                            viewMode: tabViewMode,
                            pageId: tabIndex,
                            workareaName: workareaName
                        };
                        workareaTabs[ tabIndex ] = newTab;
                        tabIndex++;
                    }
                }
            } );

            let workareaIndex = 0;
            if( workareaName === 'leftPanelTabs' || workareaName === 'topLeftPanelTabs' ) {
                workareaIndex = 1;
            } else if( workareaName === 'bottomLeftPanelTabs' ) {
                workareaIndex = 2;
            }

            workareasTabs[ workareaIndex ] = {
                tabs: workareaTabs
            };
        } );

        // Get the hidden components (Header, Footer) from preference
        const hiddenComponents = getHiddenComponents( preferences );
        if( hiddenComponents.ewiHeader === true || window.innerHeight < 450 ) {
            $( '.afx-layout-header-container' ).hide();
        } else{
            $( '.afx-layout-header-container' ).show();
        }
        if( hiddenComponents.ewiFooter === true  ) {
            $( '.afx-layout-footer-container' ).hide();
        }
        return {
            workareasTabs,
            allRelationsToLoad,
            allPropPolicy,
            policyIds,
            hiddenComponents,
            layoutName,
            views
        };
    } );
}

/**
 * Get the loaded relations objects and file tickets
 *
 * @param {ObjectArray} data - all the data
 *
 * @return {ObjectArray} allRelatedObjects - all the related objects
 */
export function loadRelations( data ) {
    let allRelatedObjects = {};
    const relatedObjectsInfo = data.relatedObjectsInfo;
    _.forEach( relatedObjectsInfo, function( currentRelationInfo ) {
        let secondaryObjects = [];
        const relatedObjects = currentRelationInfo.relatedObjects;
        if( relatedObjects ) {
            for( let j in relatedObjects ) {
                const currentRelatedObject = relatedObjects[ j ];
                // Get the secondary object
                secondaryObjects[ j ] = currentRelatedObject.relatedObject;

                // Also read the file tickets
                const fileTicketsVector = currentRelatedObject.fileTicketsVector;
                if( fileTicketsVector ) {
                    workinstrFmsSvc.updateFileTickets( fileTicketsVector );
                }
            }
        }
        allRelatedObjects[ currentRelationInfo.relation ] = secondaryObjects;
    } );

    return allRelatedObjects;
}

/**
 * Get tab related objects
 *
 * @param {Object} tab - the tab to get its related objects
 * @param {ObjectArray} allRelatedObjects - all the objects related to the current step
 *
 * @return {ObjectArray} datasetsToShow - tab related objects
 */
export function getTabRelatedData( tab, allRelatedObjects ) {
    const tabRelations = tab.relations;
    let datasetsToShow = [];
    for( let currentRelation in tabRelations ) {
        const relationRelatedObjects = allRelatedObjects[ currentRelation ];
        const currentRelationTypes = tabRelations[ currentRelation ];
        if( currentRelationTypes.length === 0 ) {
            for( let currRelatedObjIndx in relationRelatedObjects ) {
                datasetsToShow[ datasetsToShow.length ] = relationRelatedObjects[ currRelatedObjIndx ];
            }
        } else {
            for( let currTypeIndx in currentRelationTypes ) {
                const currentType = currentRelationTypes[ currTypeIndx ];
                for( let currObjIndx in relationRelatedObjects ) {
                    const currentObj = relationRelatedObjects[ currObjIndx ];
                    if( currentObj.type === currentType ) {
                        datasetsToShow[ datasetsToShow.length ] = currentObj;
                    }
                }
            }
        }
    }

    if( tab.tabKey === 'Operations' && datasetsToShow.length !== 0 ) {
        const selectedObject = appCtxSvc.getCtx( 'EWI0currentStep' );
        const resource = AwStateService.instance.params.resource;
        let operationsDatasetsToShow = [];
        let selectedOperator = null;
        if( resource !== '' ) {
            _.forEach( selectedObject.props.Mfg0processResources.uiValues, function( operator, key ) {
                if( !selectedOperator ) {
                    const processResourceObject = clientDataModelSvc.getObject( selectedObject.props.Mfg0processResources.dbValues[ key ] );
                    if( processResourceObject.props.bl_item_item_id.dbValues[ 0 ] === resource ) {
                        selectedOperator = processResourceObject;
                        _.forEach( datasetsToShow, function( operation ) {
                            if( operation.props.Mfg0processResource.dbValues[ 0 ] === selectedOperator.uid ) {
                                operationsDatasetsToShow.push( operation );
                            }
                        } );
                        datasetsToShow = operationsDatasetsToShow;
                    }
                }
            } );
        }
    }

    if( tab.tabKey === 'WorkInstructions' && datasetsToShow.length === 0 ) {
        const tabPolicy = tab.viewMode.propPolicy;
        if( tabPolicy ) {
            let str = '';
            const props = tabPolicy.types[ 0 ].properties;
            for( let currPropIndx in props ) {
                const currentPropName = props[ currPropIndx ].name;
                const currProp = _currentStep.props[ currentPropName ];
                if( currProp && currProp.uiValues[ 0 ] !== '' ) {
                    str = str + _HTML_PARA_WITH_WORKINSTR_STYLE + currProp.uiValues[ 0 ] + _HTML_PARA_END;
                }
            }
            if( str !== '' ) {
                datasetsToShow[ 0 ] = {
                    type: 'String',
                    value: str
                };
            }
        }
    }
    return datasetsToShow;
}

/**
 * Set the related objects of each tab
 *
 * @param {ObjectArray} workareasTabs - ewi sublocation workareas tabs
 * @param {ObjectArray} allRelatedObjects - all the objects related to the current step
 *
 * @return {ObjectArray} workareasTabs - the updated ewi sublocation workareas tabs
 */
export function setRelatedData( workareasTabs, allRelatedObjects, data ) {
    _.forEach( workareasTabs, function( theWorkareasTabs ) {
        let currentWorkareaTabs = theWorkareasTabs.tabs;
        let currentSelectedTab = theWorkareasTabs.selectedTab;
        // If the previous selected tab still has data - set it as the selected tab
        let currentWorkareaFilteredTabs = [];
        if( currentSelectedTab ) {
            currentSelectedTab.datasetsToShow = getTabRelatedData( currentSelectedTab, allRelatedObjects );
            currentSelectedTab.filterCondition = getFilterTab( currentSelectedTab );
            if( currentSelectedTab.filterCondition === true ) {
                theWorkareasTabs.selectedTab = currentSelectedTab;
                theWorkareasTabs.allEmpty = false;
            } else {
                theWorkareasTabs.selectedTab = null;
                theWorkareasTabs.allEmpty = true;
            }
        } else {
            theWorkareasTabs.selectedTab = null;
            theWorkareasTabs.allEmpty = true;
        }

        _.forEach( currentWorkareaTabs, function( currentTab ) {
            if( !currentSelectedTab || currentSelectedTab.name !== currentTab.name ) {
                currentTab.datasetsToShow = getTabRelatedData( currentTab, allRelatedObjects );
                currentTab.filterCondition = getFilterTab( currentTab );
                // Select the first tab that has data
                if( !theWorkareasTabs.selectedTab && currentTab.filterCondition === true ) {
                    currentTab.selectedTab = true;
                    theWorkareasTabs.selectedTab = currentTab;
                    theWorkareasTabs.allEmpty = false;
                } else {
                    currentTab.selectedTab = false;
                }
            }
        } );
        // All tabs are empty - display the first tab
        if( !theWorkareasTabs.selectedTab ) {
            currentWorkareaTabs[ 0 ].selectedTab = true;
            currentWorkareaTabs[ 0 ].filterCondition = true;
            theWorkareasTabs.selectedTab = currentWorkareaTabs[ 0 ];
        }

        _.forEach( currentWorkareaTabs, function( currentTab ) {
            if( currentTab.filterCondition === true ) {
                currentWorkareaFilteredTabs.push( currentTab );
            }
        } );
        theWorkareasTabs.filteredTabs = { tabs: currentWorkareaFilteredTabs, sharedCommandAnchor: 'workinstrPanel' };
        theWorkareasTabs.filteredTabs.reloadSelectedTab = true;
    } );
    if( data ) {
        data.dispatch( { path: 'data', value: workareasTabs } );
    }

    return {
        workareasTabsData: workareasTabs
    };
}

/**
 * Get the tab filter to know if the tab should be visible
 *
 * @param {Object} tab - the tab object to check its visibility condition
 *
 * @return {Boolean} flag - the flag to display the tab
 */
export function getFilterTab( tab ) {
    let noOfSubElements = 0;
    if( _currentStep.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_PROCESS_STATION ) > NOT_FOUND ) {
        if( _currentStep.props.Mfg0allocated_ops ) {
            noOfSubElements = _currentStep.props.Mfg0allocated_ops.dbValues.length;
        }
    } else if( _currentStep.modelType.typeHierarchyArray.indexOf( epBvrConstants.MFG_PROCESS_PARTITION ) > NOT_FOUND ) {
        noOfSubElements = _currentStep.props.bl_occgrp_visible_lines;
    } else {
        if( _currentStep.props.Mfg0sub_elements ) {
            noOfSubElements = _currentStep.props.Mfg0sub_elements.dbValues.length;
        }
    }

    const isNotLeaf = noOfSubElements >= 0;

    let showAggregate = false;
    const typeHierarchy = _currentStep.modelType.typeHierarchyArray;
    if( typeHierarchy.indexOf( epBvrConstants.MFG_PROCESS_AREA ) === -1 || typeHierarchy.indexOf( epBvrConstants.MFG_PROCESS_STATION ) > -1 ) {
        showAggregate = true;
    }

    return tab.datasetsToShow && tab.datasetsToShow.length > 0 ||
        isNotLeaf && showAggregate && ( tab.name === 'Parts' || tab.name === 'Tools' );
}

/**
 * getPackUnpackFlag - get the flag for pack/ unpack soa call according to bl_quantity property value
 *
 * @param {String} quantityValue - bl_quantity property value
 *
 * @return {Integer} flag - the flag for pack/ unpack soa call
 */
export function getPackUnpackFlag( quantityValue ) {
    return quantityValue === '' ? 2 : 1;
}

/**
 * Set the current step object
 *
 * @param {Object} workPackage - the current workPackage
 * @param {Object} currentStep - the current step
 * @param {Object} headerProps - the header properties
 * @param {String} loadHeaderProperties - should the header properties be loaded
 * @param {Object} newHeaderProps - the new header properties
 *
 * @return {String} revRuleParam - the current revrule url parameter
 * @return {String} dateParam - the current date url parameter
 * @return {String} unitNoParam - the current unitno url parameter
 * @return {String} endItemParam - the current enditem url parameter
 * @return {String} resourceParam - the current resource url parameter
 */
export function setCurrentStep( workPackage, currentStep, headerProps, loadHeaderProperties, newHeaderProps ) {
    _workPackage = workPackage;
    _currentStep = currentStep;
    _topLine = getRootModelObject( currentStep );

    if( newHeaderProps.length > 0 && newHeaderProps[ 0 ].propertyValue !== '' ) {
        headerProps = [ ...newHeaderProps ];
    }

    if( loadHeaderProperties ) {
        appCtxSvc.registerCtx( 'EWI0HeaderProperties', headerProps );
        eventBus.publish( 'ewi.updateHeaderProperties' );
    }

    appCtxSvc.registerCtx( 'EWI0currentStep', currentStep );
    eventBus.publish( 'ewi.stepChanged' );

    // Update selection for various commands like Ewi0PinObjectToHome
    selectionSvc.updateSelection( [ currentStep ] );

    // Set attached objects for Create Change ctx
    // use adapter service to find backing object in case selected object is RBO
    adapterSvc.getAdaptedObjects( [ currentStep ] ).then( function( currStep ) {
        const createChangeData = {
            appSelectedObjects: [ workPackage, currStep[ 0 ] ]
        };
        appCtxSvc.registerCtx( 'appCreateChangePanel', createChangeData );
        // For Capture command
        appCtxSvc.updatePartialCtx( 'workinstr0Vis.selectedRevObj', currStep[ 0 ] );
    } );
    // For 3D
    appCtxSvc.updatePartialCtx( 'workinstr0Vis.selectedObj', currentStep );

    // To display Dynamic Snapshot
    appCtxSvc.updatePartialCtx( 'workinstr0Vis.rootObj', _topLine );

    //for work instructions
    if( headerProps && headerProps.length > 0 ) {
        _.forEach( headerProps, function( prop ) {
            if( prop.propertyName === 'Work Instruction' ) {
                appCtxSvc.updatePartialCtx( 'workinstr0FullText.bodyText', prop.propertyValue );
            }
        } );
    }
    return {
        topLine: _topLine,
        revRuleParam: AwStateService.instance.params.revrule,
        dateParam: AwStateService.instance.params.date,
        unitNoParam: AwStateService.instance.params.unitno,
        endItemParam: AwStateService.instance.params.enditem,
        resourceParam: AwStateService.instance.params.resource,
        headerProps: headerProps
    };
}

/**
 * Returns the current step object
 *
 * @return {Object} currentStep - the current step object
 */
export function getCurrentStep() {
    return _currentStep;
}

/**
 * Returns the top line object
 *
 * @return {Object} topLine - the top line object
 */
export function getTopLine() {
    return _topLine;
}

/**
 * Returns the workPackage object
 *
 * @return {Object} workPackage - the workPackage object
 */
export function getWorkPackage() {
    return _workPackage;
}

/**
 * refreshView - set the tab that should be refreshed
 *
 * @param {Object} tab - the tab that should be refreshed
 */
export function refreshView( tab ) {
    appCtxSvc.registerCtx( 'workinstr0viewToRefresh', tab );
}

/**
 * Refresh the tabs data
 *
 * @param {ObjectArray} allPropPolicy - all the property policy to register for the tables
 * @param {StringArray} policyIds - List of policy Ids to unregister latter after the soa call
 */
export function refreshData( allPropPolicy, policyIds ) {
    // Register policies
    registerPolicies( allPropPolicy, policyIds );
    eventBus.publish( 'ewi.getRelated' );
}

/**
 * Register policies
 *
 * @param {ObjectArray} allPropPolicy - all the property policy to register for the tables
 * @param {StringArray} policyIds - List of policy Ids to unregister later
 */
export function registerPolicies( allPropPolicy, policyIds ) {
    // Register policies
    _.forEach( allPropPolicy, function( propPolicy ) {
        const policyId = policySvc.register( propPolicy );
        policyIds.push( policyId );
    } );
}

/**
 * Register extra policies like execution, operators
 *
 * @param {ObjectArray} extraPolicy - the extra policy to register
 * @param {ObjectArray} allPropPolicy - all the property policy to register for the tables
 * @param {StringArray} policyIds - List of policy Ids to unregister later
 */
export function registerExtraPolicies( extraPolicy, allPropPolicy, policyIds ) {
    // Add execution properties to load
    allPropPolicy.push( extraPolicy );
    const policyId = policySvc.register( extraPolicy );
    policyIds.push( policyId );
}

/**
 * Register work instructions properties policies
 *
 * @param {ObjectArray} workareasTabs - ewi sublocation workareas tabs
 * @param {ObjectArray} allPropPolicy - all the property policy to register for the tables
 * @param {StringArray} policyIds - List of policy Ids to unregister later
 *
 * @return {ObjectArray} workareasTabs - ewi sublocation workareas tabs
 * @return {ObjectArray} allPropPolicy - all the property policy to register for the tables
 * @return {StringArray} policyIds - List of policy Ids to unregister later
 */
export function registerWIPropertiesPolicies( workareasTabs, allPropPolicy, policyIds ) {
    for( let workareaTabsIndx in workareasTabs ) {
        const tabsList = workareasTabs[ workareaTabsIndx ].tabs;
        for( let tabsIndx in tabsList ) {
            let currTab = tabsList[ tabsIndx ];
            if( currTab.tabKey === 'WorkInstructions' ) {
                let propPolicy = {
                    types: [ {
                        name: _currentStep.type,
                        properties: []
                    } ]
                };

                const relations = currTab.relations;
                const currStepPropertiesMap = _currentStep.modelType.propertyDescriptorsMap;
                for( let relationName in relations ) {
                    const currProp = currStepPropertiesMap[ relationName ];
                    // if a String property
                    if( currProp && currProp.valueType === 8 ) {
                        propPolicy.types[ 0 ].properties.push( {
                            name: relationName
                        } );
                    }
                }
                if( propPolicy.types[ 0 ].properties.length > 0 ) {
                    allPropPolicy.push( propPolicy );
                    const policyId = policySvc.register( propPolicy );
                    policyIds.push( policyId );
                    currTab.viewMode.propPolicy = propPolicy;
                }
            }
        }
    }

    return {
        workareasTabs: workareasTabs,
        allPropPolicy: allPropPolicy,
        policyIds: policyIds
    };
}

/**
 * Unregister policies
 *
 * @param {StringArray} policyIds - List of policy Ids to unregister
 */
export function unregisterPolicies( policyIds ) {
    _.forEach( policyIds, function( policyId ) {
        policySvc.unregister( policyId );
    } );
}

/**
 * Get ItemRevision of BOMLine object
 *
 * @param {IModelObject} bomLine The BOMLine object to get its ItemRevision
 *
 * @return {IModelObject} revObject - the ItemRevision object of the bomLine
 */
export function getItemRevisionOfBomLine( bomLine ) {
    let revObject = bomLine;
    const blRev = bomLine.props.bl_revision;
    if( blRev && blRev.dbValues ) {
        const revUid = blRev.dbValues[ 0 ];
        const object = clientDataModelSvc.getObject( revUid );
        if( object ) {
            revObject = object;
        }
    }
    return revObject;
}

/**
 * Get the current step URL parameters as a String
 *
 * @return {String} paramsString - the current step URL parameters
 */
export function getUrlParams() {
    let paramsString = '';
    const params = AwStateService.instance.params;
    let paramValue;
    Object.keys( params ).forEach( function( key ) {
        paramValue = params[ key ];
        if( paramValue !== undefined && paramValue !== null ) {
            paramsString = paramsString + ';' + key + '=' + params[ key ];
        }
    } );

    return paramsString;
}

/**
 * Get the pin object to home command data
 *
 * @param {IModelObject} bomLine The current step BOMLine object
 *
 * @return {String} pinParams - the current step URL parameters
 * @return {IModelObject} revObject - ItemRevision object of the bomLine
 */
export function getPinData( bomLine ) {
    const pinParams = getUrlParams();
    const revObject = getItemRevisionOfBomLine( bomLine );

    return {
        pinParams: pinParams,
        revObject: revObject
    };
}

/**
 * Get the hidden components from preference
 *
 * @param {ObjectArray} preferences - list of preferences
 *
 * @return {ObjectArray} hiddenComponents - if the header/ footer are hidden
 */
export function getHiddenComponents( preferences ) {
    const hiddenComponentsPreference = preferences.EWI_HiddenComponents;
    let hiddenComponents = {
        ewiHeader: false,
        ewiFooter: false
    };
    _.forEach( hiddenComponentsPreference, function( hiddenComponent ) {
        if( hiddenComponent === 'Header' ) {
            hiddenComponents.ewiHeader = true;
        } else if( hiddenComponent === 'Footer' ) {
            hiddenComponents.ewiFooter = true;
        }
    } );

    return hiddenComponents;
}

/**
 * Full Screen command
 *
 * @param {String} workareaName the work area to set as full screen
 */
export function setFullScreen( workareaName ) {
    const isFullScreen = appCtxSvc.getCtx( 'EWI0FullScreen' );
    if( isFullScreen ) {
        appCtxSvc.unRegisterCtx( 'EWI0FullScreen' );
    } else {
        appCtxSvc.registerCtx( 'EWI0FullScreen', workareaName );
    }
    window.dispatchEvent( new Event( 'resize' ) );
}

/**
 * For 3D view SnapShotViewData command
 *
 * @param {Object} data the command context data
 */
export function show3DView( data ) {
    let newValues = { ...data.value };
    newValues.viewerData.fileData.viewer = 'WorkinstrSnapshotViewer';
    data.update( newValues );
}

/**
 * For 2D view SnapShotViewData command
 *
 * @param {Object} data the command context data
 */
export function show2DView( data ) {
    let newValues = { ...data.value };
    newValues.viewerData.fileData.viewer = 'Awp0ImageViewer';
    data.update( newValues );
}

/**
 * Check the vis license and put it in the ctx
 *
 * @param {int} visLicenseVal the vis license value
 * @param {String} snapshotConfiguration indicates whether to use dynamic or static configuration for creating the vvi file
 * @param {boolean} autoLoad3D whether 3D data should automatically load in the EWI viewer when the user clicks a thumbnail
 */
export function checkVisLicense( visLicenseVal, snapshotConfiguration, autoLoad3D ) {
    const visLicense = visLicenseVal > 0;
    let topLine = null;

    let workinstr0Vis = {
        visLicense: visLicense,
        snapshotConfiguration: snapshotConfiguration,
        rootObj: null,
        selectedObj: _currentStep,
        selectedRevObj: null,
        thumbnailURL: null,
        autoLoad3D: _.lowerCase( autoLoad3D )
    };

    if( _currentStep ) {
        topLine = getRootModelObject( _currentStep );
        workinstr0Vis.rootObj = topLine;
        // Use adapter service to find backing object in case selected object is RBO
        // For Capture command
        adapterSvc.getAdaptedObjects( [ _currentStep ] ).then( function( currStep ) {
            workinstr0Vis.selectedRevObj = currStep[ 0 ];
            appCtxSvc.registerCtx( 'workinstr0Vis', workinstr0Vis );
        } );
    } else {
        appCtxSvc.registerCtx( 'workinstr0Vis', workinstr0Vis );
    }
}

/**
 * Status was changed to Complete in the 'Set Step Status' panel
 * Check that all required data was filled
 *
 * @param {ObjectArray} workareasTabs - ewi sublocation workareas tabs
 * @param {ObjectArray} preferences - list of preferences
 */
export function completeStatusChanged( workareasTabs, preferences ) {
    const localTextBundle = localeSvc.getLoadedText( 'EWIMessages' );

    for( let workarea of workareasTabs ) {
        for( let tab of workarea.filteredTabs.tabs ) {
            if( tab.tabKey === 'DataCollection' ) {
                for( let dcd of tab.datasetsToShow ) {
                    const isOptionalStr = dcd.props.mes0DCDIsOptional.uiValues[ 0 ];
                    const isRequired = isOptionalStr.toLowerCase() === 'false';
                    const dcdValue = dcd.props.ewi0DCExecutionValue.dbValues[ 0 ];
                    if( isRequired && dcdValue === '' ) {
                        messagingService.showError( localTextBundle.dataCollectionMissing );
                        break;
                    }
                }
            } else if( tab.tabKey === 'Parts' ) {
                for( let part of tab.datasetsToShow ) {
                    const partQuantity = part.props.bl_quantity.dbValues[ 0 ];
                    if( partQuantity === '' || partQuantity === '0' || partQuantity === '1' ) {
                        const partSerial = part.props.ewi0SerialNumber.uiValues[ 0 ];
                        const partLot = part.props.ewi0LotNumber.uiValues[ 0 ];
                        const partIsSerialized = part.props[ preferences.EWI_PartIsSerializedProperty[ 0 ] ].uiValues[ 0 ];
                        const partIsLot = part.props[ preferences.EWI_PartIsLotProperty[ 0 ] ].uiValues[ 0 ];
                        if( partIsLot.toLowerCase() === _TRUE && partLot === '' || partIsSerialized.toLowerCase() === _TRUE && partSerial === '' ) {
                            messagingService.showError( localTextBundle.serialOrLotMissing );
                            break;
                        }
                    }
                }
            } else if( tab.tabKey === 'Tools' ) {
                for( let tool of tab.datasetsToShow ) {
                    const toolQuantity = tool.props.bl_quantity.dbValues[ 0 ];
                    if( toolQuantity === '' || toolQuantity === '0' || toolQuantity === '1' ) {
                        const toolSerial = tool.props.ewi0SerialNumber.uiValues[ 0 ];
                        const toolLot = tool.props.ewi0LotNumber.uiValues[ 0 ];
                        const toolIsSerialized = tool.props[ preferences.EWI_ToolIsSerializedProperty[ 0 ] ].uiValues[ 0 ];
                        const toolIsLot = tool.props[ preferences.EWI_ToolIsLotProperty[ 0 ] ].uiValues[ 0 ];
                        if( toolIsLot.toLowerCase() === _TRUE && toolLot === '' || toolIsSerialized.toLowerCase() === _TRUE && toolSerial === '' ) {
                            messagingService.showError( localTextBundle.serialOrLotMissing );
                            break;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Update the reloadTab flag so that the tab rerenders
 *
 * @param {ObjectArray} workareasTabsData - ewi sublocation workareas tabs
 *
 * @return {ObjectArray} workareasTabsData - the updated ewi sublocation workareas tabs
 */
export function shouldReloadTab( workareasTabsData ) {
    _.forEach( workareasTabsData, function( theWorkareasTabsData ) {
        theWorkareasTabsData.filteredTabs.reloadSelectedTab = !theWorkareasTabsData.filteredTabs.reloadSelectedTab;
    } );

    return workareasTabsData;
}

/**
 * A glue code to support electronic work instructions
 *
 * @param {Object} appCtxSvc - appCtxService
 * @param {Object} workinstrUtilsSvc - workinstrUtilsService
 * @param {Object} workinstrTableSvc - workinstrTableService
 * @param {Object} workinstrFmsSvc - workinstrFileTicketService
 * @param {Object} policySvc - soa_kernel_propertyPolicyService
 * @param {Object} clientDataModelSvc - soa_kernel_clientDataModel
 * @param {Object} awTableSvc - awTableService
 * @param {Object} $state - $state
 * @param {Object} adapterSvc - adapterService
 * @param {Object} messagingService - messagingService
 * @param {Object} localeSvc - localeService
 * @param {Object} cfgSvc - configurationService
 * @param {Object} viewModelSvc - viewModelService
 * @param {Object} breadCrumbSvc - breadCrumbService
 * @param {Object} selectionSvc - selectionService

 * @return {Object} - Service instance
 *
 * @member ewiService
 */

export default {
    getParentUid,
    getRootModelObject,
    getModelObjectSubElements,
    loadSubElements,
    navigateToSelectedObject,
    computeLayoutAndGetUpdatedWorkareasTabsData,
    shouldReloadProps,
    getLayoutTabsFromPreference,
    loadRelations,
    getTabRelatedData,
    setRelatedData,
    getFilterTab,
    getPackUnpackFlag,
    setCurrentStep,
    getCurrentStep,
    getTopLine,
    getWorkPackage,
    refreshView,
    refreshData,
    registerPolicies,
    registerExtraPolicies,
    registerWIPropertiesPolicies,
    unregisterPolicies,
    getItemRevisionOfBomLine,
    getUrlParams,
    getPinData,
    getHiddenComponents,
    setFullScreen,
    show3DView,
    show2DView,
    checkVisLicense,
    completeStatusChanged,
    shouldReloadTab
};
