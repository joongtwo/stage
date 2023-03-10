// Copyright (c) 2022 Siemens

/**
 * @module js/pca0InlineAuthoringHandler
 */
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import dataSourceService from 'js/dataSourceService';
import editHandlerSvc from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import parsingUtils from 'js/parsingUtils';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0InlineAuthoringEditService from 'js/pca0InlineAuthoringEditService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import pca0VCAUtils from 'js/pca0VCAUtils';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';

import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Returns View Model Tree Node for the input model object
 * @param {Object} modelObj - The model object
 * @param {Object} parentNode - The parent node for modelObj
 * @returns {Object} - View Model Tree Node object
 */
let _createViewModelTreeNodeUsingVMO = function( modelObj, parentNode ) {
    // Get child node level index
    let childlevelIndex = 0;
    if( parentNode ) {
        childlevelIndex = parentNode.levelNdx + 1;
    }

    // Create view model tree node
    let iconURL = iconSvc.getTypeIconURL( modelObj.type );
    let childIdx = parentNode.childNdx;

    // Get display name
    let displayName = _getInlineRowDisplayName( modelObj );

    let vmNode = awTableSvc.createViewModelTreeNode( modelObj.uid, modelObj.type, displayName, childlevelIndex, childIdx, iconURL );

    vmNode.isLeaf = true;
    vmNode.getId = function() {
        return this.uid;
    };
    vmNode.parentUid = parentNode.uid;
    vmNode.isInlineRow = true;

    return vmNode;
};

/**
 * Returns display value for inline row
 * @param {Object} inlineRowVMO - The model object
 * @returns {String} - The display value for inline row
 */
let _getInlineRowDisplayName = function( inlineRowVMO ) {
    // Get display name
    let localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    let displayName = localeTextBundle.Pca0New + ' ' + localeTextBundle.Pca0Element;
    // Validating only default target types based on command selection
    if( inlineRowVMO.type === 'Cfg0FamilyGroup' ) {
        displayName = localeTextBundle.Pca0New + ' ' + localeTextBundle.Pca0AddFamilyGroupTitle;
    } else if( inlineRowVMO.type === 'Cfg0LiteralValueFamily' ) {
        displayName = localeTextBundle.Pca0New + ' ' + localeTextBundle.Pca0AddFamilyTitle;
    } else if( inlineRowVMO.type === 'Cfg0LiteralOptionValue' ) {
        displayName = localeTextBundle.Pca0New + ' ' + localeTextBundle.Pca0AddFeatureTitle;
    }
    return displayName;
};

/**
 * Add inline row to parent node
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childNode - inline row view model object to be added under parent node
 * @param {Object} childNodeIndex - index under parent node at which child node to be added
 */
let _addChildToParentsChildrenArray = function( parentNode, childNode, childNodeIndex ) {
    if( parentNode ) {
        if( !parentNode.children || parentNode.children.length === 0 ) {
            parentNode.expanded = true;
            parentNode.isExpanded = true;
            parentNode.children = [];
        }
        childNodeIndex < parentNode.children.length ? parentNode.children.splice( childNodeIndex, 0, childNode ) :
            parentNode.children.push( childNode );
        parentNode.isLeaf = false;
        parentNode.totalChildCount = parentNode.children.length;
    }
};

/**
 * Add inline row into View Model Object list
 * @param {Object} treeDataProvider - tree Data Provider
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childVMO - inline row view model object to view model object collection
 */
let _insertInlineRow = function( treeDataProvider, parentNode, childVMO ) {
    {
        //LCS-730555 - Issue while adding new row under Unassigned Families Group for first time
        //For Unassigned Group the prop .isExpanded was undefined, We are manually setting it to true
        if( parentNode.id === pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION ) {
            parentNode.isExpanded = true;
        }
        //For cached data we are getting isExpanded prop as undefined, manually setting it to false
        if( parentNode.isExpanded === undefined ) {
            parentNode.isCatched = true;
        } else {
            parentNode.isCatched = false;
        }
        // expand parent node if not already expanded
        if( !parentNode.isInlineRow && !parentNode.isExpanded ) {
            eventBus.publish( treeDataProvider.name + '.expandTreeNode', {
                parentNode: parentNode
            } );
        }
    }

    // Insert the new treeNode in the viewModelCollection at the correct location
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let expectedInlineRowIdx = viewModelCollection.indexOf( parentNode ) + 1;
    viewModelCollection.splice( expectedInlineRowIdx, 0, childVMO );

    // Add the new treeNode to the parentVMO and update view model collection
    _addChildToParentsChildrenArray( parentNode, childVMO, parentNode.childNdx );
    treeDataProvider.update( viewModelCollection );
    treeDataProvider.setSelectionEnabled( true );
};

/**
 * Creates a data source for edit handler
 * @param {Object} dataProviders - data providers
 * @return {Object} dataSource instance
 */
let _createDatasource = function( dataProviders ) {
    let declViewModel = {};
    declViewModel.dataProviders = dataProviders;
    return dataSourceService.createNewDataSource( {
        declViewModel: declViewModel
    } );
};

/**
 * This method will update the cfg0MaximumValue and cfg0MinimumValue's properties as in updatePropValMap
 *
 * @param {object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {object} updatePropValMap - property to value map object which is used for updating cfg0MaximumValue, and cfg0MinimumValue
 */
let _updateMinMaxValueDataType = function( widgetVmo, updatePropValMap ) {
    Object.keys( updatePropValMap ).forEach( property => {
        if( !_.isUndefined( widgetVmo.props.cfg0MaximumValue ) ) {
            widgetVmo.props.cfg0MaximumValue[ property ] = updatePropValMap[ property ];
        }
        if( !_.isUndefined( widgetVmo.props.cfg0MinimumValue ) ) {
            widgetVmo.props.cfg0MinimumValue[ property ] = updatePropValMap[ property ];
        }
    } );
    viewModelObjectSvc.updateVMOProperties( widgetVmo );
};

/**
 * Renders the inline row after creation.
 * @param {Object} targetObjectType - target Object Type
 * @param {Object} parentNode - parent Node
 * @param {Object} unsavedRowList - the unsaved Row List
 * @param {Object} newRowCacheMap - the new row CacheMap
 * @param {Object} treeDataProvider - the treeDataProvider
 * @param {String} inlineAuthoringHandlerContext - the context,
 * @param {Object} objectTypesCacheMap - the objectTypesCacheMap to be passed into the type LOV component
 * @returns {Object} - Returns updated unsavedRowList
 */
export let renderInlineRow = function( targetObjectType, parentNode, unsavedRowList, newRowCacheMap, treeDataProvider, inlineAuthoringHandlerContext, objectTypesCacheMap ) {
    let deferred = awPromiseService.instance.defer();

    let getViewModelForCreateResponse = { ...newRowCacheMap[ targetObjectType ] };
    if( getViewModelForCreateResponse && parentNode ) {
        // Create model object from json string
        getViewModelForCreateResponse.parentNode = parentNode;
        let serverVMO = parsingUtils.parseJsonString( getViewModelForCreateResponse.viewModelObject );

        // set unique id for each model object
        serverVMO.uid = pca0VCAUtils.instance.getUniqueID();

        // Modity the target VMO type to enable desired ui widget for editable cell
        if( parentNode.props.hasOwnProperty( 'cfg0ValueDataType' ) ) {
            // Intentionally comparing dbValue instead of uiValue to support use case in any locale,
            // As dbValue will remain same even if user changes display value for feature data types.
            if( parentNode.props.cfg0ValueDataType.dbValue === 'Date' ) {
                serverVMO.props.object_name.type = 2;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 2;
                }
            }
            if( parentNode.props.cfg0ValueDataType.dbValue === 'Integer' ) {
                serverVMO.props.object_name.type = 5;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 5;
                }
            }
            if( parentNode.props.cfg0ValueDataType.dbValue === 'Floating Point' ) {
                serverVMO.props.object_name.type = 3;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 3;
                }
            }
        }

        // Replace json string with the model object
        getViewModelForCreateResponse.viewModelObject = serverVMO;
        unsavedRowList.push( getViewModelForCreateResponse );

        // Create VMO for inline row
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( serverVMO, 'EDIT' );
        let updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, serverVMO );
        updatedVMO.setEditableStates( true, true, true );
        let childVMO = _createViewModelTreeNodeUsingVMO( updatedVMO, parentNode );
        _.merge( childVMO, updatedVMO );

        let currentContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        if( currentContext.reuseMode && currentContext.reuseMode === true ) {
            [ 'object_name', 'cfg0ObjectId' ].forEach( function( propname ) {
                if( childVMO.props[ propname ] ) {
                    childVMO.props[ propname ].hasLov = true;
                    if( childVMO.props[ propname ].type === 'DATE' ) {
                        childVMO.props[ propname ].hasLov = false;
                    }
                }
            } );
        }
        childVMO.serverVMO = serverVMO;
        //add required in the vmo for name column on group, family and feature
        //this required will then be shown in editing mode in the text area when it's empty
        //the requirement to show it generally (not when text area exists aka focused column) is hadnled via renderer
        childVMO.props.object_name.isRequired = true;
        if( childVMO.props.object_type ) {
            childVMO.props.object_type.objectTypesCachedValues = objectTypesCacheMap[targetObjectType];
        }

        // Insert VMO into tree
        _insertInlineRow( treeDataProvider, parentNode, childVMO );

        // Set edit handler
        let dataProvider = treeDataProvider;
        editHandlerSvc.setEditHandler( pca0InlineAuthoringEditService, inlineAuthoringHandlerContext );
        editHandlerSvc.setActiveEditHandlerContext( inlineAuthoringHandlerContext );
        let dataSource = _createDatasource( { treeDataProvider: dataProvider } );
        pca0InlineAuthoringEditService.setDataSource( dataSource );

        let currentInlineAuthoringContext = { inlineAuthoringContext: {} };
        currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = true;

        // Update inline authoring mode in ctx
        for( const key of Object.keys( currentInlineAuthoringContext ) ) {
            currentContext[ key ] = currentInlineAuthoringContext[ key ];
        }
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY, currentContext );

        // Define callback for save/discard actions
        let callBackObj = {
            inlineAuthoringEditHandler: inlineAuthoringHandlerContext,
            cancelEdits: function() {
                return cancelEdits();
            },
            saveEdits: function() {
                return saveEdits( callBackObj.inlineAuthoringEditHandler );
            }
        };
        pca0InlineAuthoringEditService.startEdit( callBackObj );
        deferred.resolve( unsavedRowList );
    }

    return deferred.promise;
};

/**
 * Cancels the edits by discarding all the unsaved rows and removes the edit handler
 */
export let cancelEdits = function() {
    eventBus.publish( 'pca0InlineAuthoringHandler.discardUnsavedAndResetInlineDataCache' );
};

/**
 * Saves the edits by trigegring the SOA call
 * @param {String} inlineAuthoringHandlerContext - edit handler name
 */
export let saveEdits = function( inlineAuthoringHandlerContext ) {
    exports.removeEditHandler( inlineAuthoringHandlerContext );
    appCtxService.updateCtx( 'editInProgress', false );
    // invoke viewmodelaction saveInlineRows
    eventBus.publish( 'Pca0InlineAuthoring.createVariabilityObject' );
};

/**
 * Returns list of properties visisble in the table.
 * @param {Object} data - the viewModel data
 * @returns {Object} - Returns the list of properties
 */
export let populateVisiblePropertyList = function( data ) {
    let propertyNames = [ 'object_string' ];
    _.forEach( data.dataProviders.treeDataProvider.columnConfig.columns, function( column ) {
        if( column.hiddenFlag !== undefined && column.hiddenFlag === false ) {
            propertyNames.push( column.propertyName );
        }
    } );
    propertyNames = _.uniq( propertyNames );
    return propertyNames;
};

/**
 * Resets inline row cache
 * @returns {object} empty object to be set for inline row cache
 */
export let resetInlineDataCache = function() {
    // reset inline authoring handler status
    pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );

    // set inlineauthoring mode as false
    let currentInlineAuthoringContext = { inlineAuthoringContext: {} };
    currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = false;

    // update inline authoring mode in ctx
    let currentContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    for( const key of Object.keys( currentInlineAuthoringContext ) ) {
        currentContext[ key ] = currentInlineAuthoringContext[ key ];
    }
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY, currentContext );

    // reset unsavedRows list info in viewmodel
    return [];
};

/**
 * Updates inline row cache after partial success, keeps around only the still unsaved rows and also
 * returns the saved ones for further processing
 * @param {object} unsavedRows - unsaved Rows
 * @param {object} serviceData - service Data
 * @param {object} treeDataProvider - treeDataProvider
 * @returns {object} object containing the 2 sub arrays of saved and unsaved rows (one will stay, one will get processed)
 */
export let updateUnsavedRows = function( unsavedRows, serviceData, treeDataProvider ) {
    let newUnsavedRows = [ ...unsavedRows ];
    let savedRows = [ ...unsavedRows ];

    if( unsavedRows && serviceData && serviceData.partialErrors ) {
        //get the new UnsavedRows array = old minus the rows created
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return serviceData.partialErrors.some( function( partialError ) {
                let shouldStay = partialError.clientId === undefined || partialError.clientId === inlineRow.viewModelObject.uid;
                //you also need to include the hierarchy under a potentially unsavable row
                //since you don't get in the response what rows have been saved, just the ones that have not and
                //the response won't include children, so they would be lost
                if( !shouldStay && inlineRow.parentNode && ( inlineRow.parentNode.uid === partialError.clientId ||
                        inlineRow.parentNode.parentUid && inlineRow.parentNode.parentUid === partialError.clientId ) ) {
                    shouldStay = true;
                }
                // We only want to show failed rows for ERROR/FATAL Level i.e. level = 3 or 4
                // So checking error value level if it is info or warning we will skip showing failed rows.
                // user will get info/warning message popup though.
                if( partialError.errorValues[ 0 ].level < 3 ) {
                    shouldStay = false;
                }
                if( shouldStay ) {
                    let treeVMO = _getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
                    let msg = partialError.errorValues[ 0 ].message;
                    treeVMO.partialErrorText = msg;
                    inlineRow.partialErrorText = msg;
                }
                return shouldStay;
            } );
        } );
        savedRows = unsavedRows.filter( x => !newUnsavedRows.includes( x ) );
    }
    let failedUnsavedRows = newUnsavedRows.map( function( row ) {
        return { ...row };
    } );

    // Disable inline authoring mode when there are no unsaved or failedunsaved rows.
    // This will disable Save button implicitly.
    if( newUnsavedRows.length === 0 || failedUnsavedRows.length === 0 ) {
        let contextKey = veConstants.CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    }
    return {
        unsavedRows: newUnsavedRows,
        savedRows: savedRows,
        failedUnsavedRows: failedUnsavedRows
    };
};

/**
 * Give inline row by the give UID
 * @param {object} treeDataProvider Tree data provider
 * @param {Object} uid UID of the VMO to fetch from View Model Collection
 * @return {Object} - Returns inline row object for given uid
 */
let _getInlineRowByUid = function( treeDataProvider, uid ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let inlineRowobjectIdx = viewModelCollection.findViewModelObjectById( uid );
    return viewModelCollection.getViewModelObject( inlineRowobjectIdx );
};

/**
 * Returns create input object for unsaved row vmo
 * @param {Object} unsavedRow - Unsaved row vmo
 * @param {object} treeDataProvider Tree data provider
 * @returns {Object} - Returns the parent node uid
 */
let _populateCreateObjectInput = function( unsavedRow, treeDataProvider ) {
    let creInput = {};
    //LCS-730556 - Getting error while creating Custom Data in AW
    creInput = _populateInputStringProps( treeDataProvider, unsavedRow.viewModelObject.uid );
    if( _.isUndefined( creInput.propertyNameValues.object_type ) ) {
        creInput.boName = unsavedRow.viewModelObject.type;
    } else if( !_.isEmpty( creInput.propertyNameValues.object_type[ 0 ] ) ) {
        creInput.boName = creInput.propertyNameValues.object_type[ 0 ];
        delete creInput.propertyNameValues.object_type;
    }
    let parentNode = unsavedRow.parentNode;
    return { creInput, parentNode };
};

/**
 * Returns string property map based  on prepopuated values from VMO and updates it with any modification user did
 * @param {object} treeDataProvider - Tree data provider
 * @param {Object} uid - Uid of a row to be saved
 * @returns {Object} - Returns the parent node uid
 */
let _populateInputStringProps = function( treeDataProvider, uid ) {
    let stringProps = {
        boName: '',
        propertyNameValues: {},
        compoundCreateInput: {}
    };

    let inlineRowVmo = _getInlineRowByUid( treeDataProvider, uid );
    _.forEach( inlineRowVmo.props, function( prop ) {
        if( prop.isEditable && prop.propertyName !== 'object_type' && prop.propertyName !== 'object_name' ) {
            stringProps.propertyNameValues[ prop.propertyName ] = [ prop.dbValues.length > 0 && prop.dbValues[ 0 ] !== null ? prop.dbValues[ 0 ] : '' ];
        }
    } );
    let rowDirtyProps = inlineRowVmo.getSaveableDirtyProps();
    if( rowDirtyProps && rowDirtyProps.length > 0 ) {
        for( let prop in rowDirtyProps ) {
            if( rowDirtyProps.hasOwnProperty( prop ) ) {
                let modifiedPropName = rowDirtyProps[ prop ].name;
                stringProps.propertyNameValues[ modifiedPropName ] = [ rowDirtyProps[ prop ].values[ 0 ] ];
            }
        }
    }
    return stringProps;
};

/**
 * Returns the create input objects for all unsaved rows
 * @param {Object} eventData - vmo and update value
 * @param {object} treeDataProvider - Tree data provider
 * @param {Object} widgetPropertyName - Widget property name
 *
 */
export let updateInlineRowVMOProperties = function( eventData, treeDataProvider, widgetPropertyName ) {
    let inlineRow = treeDataProvider.selectedObjects[ 0 ];
    //this is the selection case - make everything read only but the name col
    let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.uid );
    if( existingParentNodeIdx !== -1 ) {
        let row = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );

        //this is the add case - everything stays as it is or reverses to original
        if( !eventData.lovValue.mo && !eventData.lovValue.selected ) {
            if( !row.isAllocation ) {
                return;
            }
            //if we allocate before, we need to go back to the inline state of it
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( row.serverVMO, 'EDIT' );
            let updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, row.serverVMO );
            updatedVMO.props[ widgetPropertyName ] = row.props[ widgetPropertyName ];
            row.props = updatedVMO.props;
            row.setEditableStates( true, true, true );
        } else {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( eventData.response.modelObjects[ eventData.lovValue.mo.uid ], 'EDIT' );
            let newInlineRow = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, eventData.response.modelObjects[ eventData.lovValue.mo.uid ] );
            row.isAllocation = true;
            // update serverUid property with actual persisted uid of object.
            // This will be consumed while preparing createInput for createAndAddObjects2 SOA
            row.serverUid = vmo.uid;
            row.displayName = vmo.props.object_string.dbValue;

            _.forEach( row.props, function( prop ) {
                if( prop.propertyName !== widgetPropertyName ) {
                    if( newInlineRow.props[ prop.propertyName ] ) {
                        _.merge( prop, newInlineRow.props[ prop.propertyName ] );
                    } else {
                        //the others should also move to read only state
                        prop.editable = false;
                        prop.isEditable = false;
                    }
                }
            } );
        }
    }

    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    treeDataProvider.update( viewModelCollection );
};

/**
 * Returns the create input objects for all unsaved rows
 * @param {Object} unsavedRows - List of all unsaved rows to be saved
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the parent node uid
 */
export let populateInlineRows = function( unsavedRows, treeDataProvider ) {
    let bulkCreateInput = [];
    _.forEach( unsavedRows, function( inlineRow ) {
        let inputObj = _populateCreateObjectInput( inlineRow, treeDataProvider );

        // Check if parent is unassigned family group, change it to root context if so
        if( _.get( inputObj, 'parentNode.uid' ) === pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
            inputObj.parentNode = _getInlineRowByUid( treeDataProvider, inputObj.parentNode.parentUID );
        }
        let createInput1 = {
            clientID: inlineRow.viewModelObject.uid,
            childCreateInputs: []
        };

        // Check if object getting reused or getting newly created, accordingly create SOA input.
        let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        _.forEach( viewModelCollection, function( vmo ) {
            if( vmo.id === inlineRow.viewModelObject.uid ) {
                if( vmo.isAllocation ) {
                    createInput1.variabilityObject =  { uid:vmo.serverUid };
                    createInput1.createIn = {
                        boName: '',
                        propertyNameValues: {},
                        compoundCreateInput: {}
                    };
                } else {
                    createInput1.createIn =  inputObj.creInput;
                    createInput1.variabilityObject =  undefined;
                }
            }
        } );

        // Check if parent of inline row is another inline row itself
        let isCreateInAdded = false;

        _.forEach( bulkCreateInput, function( bulkInput ) {
            if( bulkInput.parent.uid === inlineRow.parentNode.uid ) {
                bulkInput.createInputs.push( createInput1 );
                isCreateInAdded = true;
            } else {
                _.forEach( bulkInput.createInputs, function( createIn ) {
                    if( createIn.clientID === inlineRow.parentNode.uid ) {
                        createIn.childCreateInputs.push( createInput1 );
                        isCreateInAdded = true;
                    } else {
                        _.forEach( createIn.childCreateInputs, function( childInput ) {
                            if( childInput.clientID === inlineRow.parentNode.uid ) {
                                childInput.childCreateInputs.push( createInput1 );
                                isCreateInAdded = true;
                            }
                        } );
                    }
                } );
            }
        } );
        if( !isCreateInAdded ) {
            let objectsToCreateAndAdd = {
                parent: {},
                createInputs: []
            };
            objectsToCreateAndAdd.parent = inputObj.parentNode;
            objectsToCreateAndAdd.createInputs.push( createInput1 );
            bulkCreateInput.push( objectsToCreateAndAdd );
        }
    } );
    return bulkCreateInput;
};

/**
 * Updates the view model collection based on response from createAndAddObjects2 SOA
 * @param {Object} savedRows - succesfully saved inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @param {object} soaResponse - Response from createAndAddObjects2 SOA
 * @param {object} selectSavedRows - select Saved Rows flag - false for the unsuccess use case, true for the success one
 * @returns {Object} - Returns the list of newly authored rows which needs to be selected
 */
export let postSaveHandler = function( savedRows, treeDataProvider, soaResponse, selectSavedRows ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let parentVMOs = [];
    let selectionMOList = [];
    _.forEach( savedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            viewModelCollection.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from chilren array of parent node
        let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
            // There could be mulitple inline rows that could be created under same parent node
            // Hence create unique list of parent node
            let index = parentVMOs.indexOf( parentVMO );
            if( index === -1 ) {
                parentVMOs.push( parentVMO );
            }
        }
    } );
    // Create parent children map for each ParentVMO and update viewModelCollection with newly authored objects.
    for( let parentNodeIdx = 0; parentNodeIdx < parentVMOs.length; parentNodeIdx++ ) {
        let parentVMO = parentVMOs[ parentNodeIdx ];
        let inputNode = _.find( pca0CommonUtils.getVariabilityNodes( soaResponse ), { nodeUid: parentVMO.nodeUid } );
        let childUids = [];
        if( !_.isUndefined( inputNode.childrenUids ) ) {
            childUids = inputNode.childrenUids;
        }

        for( let childIdx = 0; childIdx < childUids.length; childIdx++ ) {
            let childVMOIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( childUids[ childIdx ] );
            if( childVMOIdx === -1 ) {
                // Insert new object replacing the inline rows
                let levelNdx = parentVMO.levelNdx + 1;
                soaResponse.resetColumnProperties = true;
                let childVMOTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode( childUids[ childIdx ], levelNdx, parentVMO.uid, parentVMO.alternateID, childIdx, soaResponse );

                if( !_.isUndefined( childVMOTreeNode.childrenUids ) && childVMOTreeNode.childrenUids.length > 0 ) {
                    childVMOTreeNode.isExpanded = true;
                    childVMOTreeNode.isLeaf = false;
                } else {
                    childVMOTreeNode.isLeaf = true;
                }
                let selObj = cdm.getObject( childVMOTreeNode.uid );
                selObj.alternateID = childVMOTreeNode.alternateID;
                selectionMOList.push( selObj );

                if( _.isUndefined( parentVMO.children ) ) {
                    parentVMO.children = [];
                }
                // Add the new treeNode to the parentVMO and update view model collection
                let newIdx = viewModelCollection.indexOf( parentVMO ) + 1;

                viewModelCollection.splice( newIdx, 0, childVMOTreeNode );
                _addChildToParentsChildrenArray( parentVMO, childVMOTreeNode, parentVMO.childNdx );

                // In case of nested data creation, these child nodes may be the parent of other new nodes.
                // However these new nodes are not part of existing view model collection.
                // Hence add such nodes to parentVMOs
                let index = parentVMOs.findIndex( obj => obj.uid === childVMOTreeNode.uid );
                if( index === -1 && !childVMOTreeNode.isLeaf ) {
                    parentVMOs.push( childVMOTreeNode );
                }
            }
        }
    }
    if( selectSavedRows ) {
        treeDataProvider.selectionModel.setSelection( selectionMOList );
    }
    treeDataProvider.update( viewModelCollection );
    //remove the inline rows
    exports.removeInlineRowsAfterSave( savedRows, treeDataProvider );
    return selectionMOList;
};

/**
 * Removes the inline rows after save
 * @param {Object} savedRows - the array of rows to remove
 * @param {object} treeDataProvider - the tree data provider
 */
export let removeInlineRowsAfterSave = function( savedRows, treeDataProvider ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    //remove the inline rows
    _.forEach( savedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            viewModelCollection.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from chilren array of parent node
        let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
            if( parentVMO.children.length > 0 ) {
                let inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
                if( inlineRowIdxFromChildArray !== -1 ) {
                    parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
                }
            }
        }
    } );
    treeDataProvider.update( viewModelCollection );
};

/**
 * Returns the new row cache after a server call filled with the necessary info
 * to create further rows of the same type from cache
 * @param {Object} response - the response from server
 * @param {object} data - the view model data
 * @returns {Object} - Returns new row cache
 */
export let cacheInlineRowFromServerResponse = function( response, data ) {
    let newRowCacheMap = { ...data.newRowCacheMap };
    let targetObjectType = data.eventData.targetObjectType;
    if( !response.ServiceData.partialErrors || response.ServiceData.partialErrors.length === 0 ) {
        newRowCacheMap[ targetObjectType ] = response;
    }

    data.newRowCacheMap = newRowCacheMap;
    return newRowCacheMap;
};


/**
 * Removes the unsaved children from unsavedRows array and view model
 *
 * @param {object} eventData - eventData
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows
 */
export let removeUnsavedChildrenForFamily = function( eventData, unsavedRows, treeDataProvider ) {
    let newUnsavedRowsResult = removeUnsavedRows( eventData.vmo, unsavedRows, treeDataProvider, true );
    eventData.vmo.children = [];
    return newUnsavedRowsResult;
};

/**
 * Removes the unsaved children from unsavedRows array and view model
 *
 * @param {object} eventData - eventData
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows
 */
export let removeUnsavedChildrenAfterFamilyDataTypeChange = function( eventData, unsavedRows, treeDataProvider ) {
    //remove children
    let newUnsavedRowsResult = exports.removeUnsavedChildrenForFamily( eventData, unsavedRows, treeDataProvider );

    //save the changed type to unsaved rows, because it keeps the old value preserved in case of cancelling
    let vmoRowToUpdate = newUnsavedRowsResult.unsavedRows.find( function( inlineRow ) {
        return eventData.vmo.uid === inlineRow.viewModelObject.uid;
    } );
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let vmoDPRow = viewModelCollection.getLoadedViewModelObjects().find( function( row ) {
        return eventData.vmo.uid === row.uid;
    } );
    if( vmoRowToUpdate && vmoDPRow ) {
        vmoRowToUpdate.viewModelObject.props.cfg0ValueDataType = { ...vmoDPRow.props.cfg0ValueDataType };
    }
    return newUnsavedRowsResult;
};

/**
 * Reverses the already selected data family type upon confirmation of cancelling removal of children action
 *
 * @param {object} eventData - eventData
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 */
export let reverseDataTypefamilySelection = function( eventData, unsavedRows, treeDataProvider ) {
    if( eventData.vmo && eventData.vmo.props.cfg0ValueDataType ) {
        //get the new vmo and set the previous value to it - get it from the unsaved rows
        let vmoRowToReverse = unsavedRows.find( function( inlineRow ) {
            return eventData.vmo.uid === inlineRow.viewModelObject.uid;
        } );

        if( vmoRowToReverse ) {
            let viewModelCollection = treeDataProvider.getViewModelCollection();
            let vmoDPRow = viewModelCollection.getLoadedViewModelObjects().find( function( row ) {
                return eventData.vmo.uid === row.uid;
            } );
            if( vmoDPRow ) {
                let prevLovuiValue = vmoDPRow.props.cfg0ValueDataType.previousSelectedLovs[ 0 ].uiValue;
                let prevLovdbValue = vmoDPRow.props.cfg0ValueDataType.previousSelectedLovs[ 0 ].dbValue;
                vmoDPRow.props.cfg0ValueDataType.dbValue = prevLovdbValue;
                vmoDPRow.props.cfg0ValueDataType.dbValues = [ prevLovdbValue ];
                vmoDPRow.props.cfg0ValueDataType.uiValue = prevLovuiValue;
                vmoDPRow.props.cfg0ValueDataType.uiValues = [ prevLovuiValue ];
                treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );

                //reverting the previousSelectedLovs prop to store current selected value
                vmoDPRow.props.cfg0ValueDataType.previousSelectedLovs[ 1 ] = vmoDPRow.props.cfg0ValueDataType.previousSelectedLovs[ 0 ];

                //reverting the min-max columns widgets
                updateMinMaxValueTypeBasedOnFamilyDataType( eventData.vmo, treeDataProvider );
            }
        }
    }
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model
 *
 * @param {object} eventData - Event Data
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows and failed unsaved rows
 */
export let removeUnsavedRow = function( eventData, unsavedRows, treeDataProvider ) {
    if( !eventData || !eventData.row ) {
        return unsavedRows;
    }
    var parentElementUId = eventData.row.parentUid;
    let newUnsavedRowsResult = removeUnsavedRows( eventData.row, unsavedRows, treeDataProvider, false );
    let newUnsavedRows = newUnsavedRowsResult.unsavedRows;
    let newFailedUnsavedRows = newUnsavedRowsResult.failedUnsavedRows;
    //set selection back to parent
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let parentNodeIndex = viewModelCollection.findViewModelObjectById( parentElementUId );
    let parentNode = viewModelCollection.getViewModelObject( parentNodeIndex );
    //remove selected row from children of the parent
    let inlineRowIdxFromChildArray = parentNode.children.findIndex( obj => obj.uid === eventData.row.uid );
    if( inlineRowIdxFromChildArray !== -1 ) {
        parentNode.children.splice( inlineRowIdxFromChildArray, 1 );
    }
    //Changing the property of the parentnode after all rows are removed to remove the expand icon
    if( parentNode.children.length === 0 ) {
        parentNode.isLeaf = true;
    }
    treeDataProvider.selectionModel.setSelection( parentNode );
    if( newUnsavedRows.length === 0 ) {
        pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );
    }
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model or just the children
 *
 * @param {object} selectedRow - selected Row
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @param {Boolean} removeChildrenOnly - optional, removes the children but not the selected row passed in
 * @returns {Object} - Returns the updated list of unsavedRows
 */
let removeUnsavedRows = function( selectedRow, unsavedRows, treeDataProvider, removeChildrenOnly ) {
    let toRemoveRows = [];
    let newUnsavedRows = [ ...unsavedRows ];
    if( selectedRow && unsavedRows ) {
        if( !removeChildrenOnly ) {
            toRemoveRows.push( selectedRow );
        }
        // go through all max 2 layers of children and collect them all
        if( selectedRow.children && selectedRow.children.length > 0 ) {
            _.forEach( selectedRow.children, function( child ) {
                if( child.isEditing && child.isInlineRow ) {
                    toRemoveRows.push( child );
                    if( child.children && child.children.length > 0 ) {
                        _.forEach( child.children, function( childschild ) {
                            if( child.isEditing && child.isInlineRow ) {
                                toRemoveRows.push( childschild );
                            }
                        } );
                    }
                }
            } );
        }
        //get the new UnsavedRows array = old minus the rows to remove
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return !toRemoveRows.some( function( inlineRowToRemove ) {
                return inlineRowToRemove.uid === inlineRow.viewModelObject.uid;
            } );
        } );

        // remove those rows from the loaded objects as well in the viewModelCollection
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        viewModelCollection.removeLoadedObjects( toRemoveRows );
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
        treeDataProvider.setSelectionEnabled( true );
    }
    // LCS-711405 After authoring a new row and deleting it save command not getting disabled
    // Disable inline authoring mode when there are no unsaved rows.
    // This property will govern Pca0SaveEditsTableCommandHandler behavior.
    if( newUnsavedRows.length === 0 ) {
        let contextKey = veConstants.CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    }
    //there may be unsaved rows that are not a fail, new ones getting added and removed, so manage the failed ones separately
    let newUnsavedRowstoFilter = [ ...newUnsavedRows ];
    let newFailedUnsavedRows = newUnsavedRowstoFilter.filter( function( inlineRow ) {
        return inlineRow.partialErrorText !== undefined;
    } );

    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Removes the saved selection plus all the underlaying children from saved array and view model
 *
 * @param {object} eventData - Event Data
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} -
 */
export let removeSavedRowAndChildrenFromUi = function( eventData, treeDataProvider ) {
    if( !eventData || !eventData.row ) {
        return false;
    }
    var parentElementUId = eventData.row.parentUid;
    let viewModelCollection = _.cloneDeep( treeDataProvider.getViewModelCollection() );
    let rowsToBeRemoved = [];
    let selectedRow = eventData.row;
    if( selectedRow ) {
        rowsToBeRemoved.push( selectedRow );
        // go through all max 2 layers of children and collect them all
        if( selectedRow.children && selectedRow.children.length > 0 ) {
            _.forEach( selectedRow.children, function( child ) {
                rowsToBeRemoved.push( child );
                if( child.children && child.children.length > 0 ) {
                    _.forEach( child.children, function( childschild ) {
                        rowsToBeRemoved.push( childschild );
                    } );
                }
            } );
        }
        // remove those rows from the loaded objects as well in the viewModelCollection
        viewModelCollection.removeLoadedObjects( rowsToBeRemoved );
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
        treeDataProvider.setSelectionEnabled( true );
    }

    //set selection back to parent
    let parentNodeIndex = viewModelCollection.findViewModelObjectById( parentElementUId );
    let parentNode = viewModelCollection.getViewModelObject( parentNodeIndex );

    //remove selected row from children of the parent
    let inlineRowIdxFromChildArray = parentNode.children.findIndex( obj => obj.uid === eventData.row.uid );
    if( inlineRowIdxFromChildArray !== -1 ) {
        parentNode.children.splice( inlineRowIdxFromChildArray, 1 );
    }
    treeDataProvider.selectionModel.setSelection( parentNode );
};

/**
 * Updates the column configuration based on response
 *
 * @param {object} response - SOA response for getTableViewModelProperties
 * @param {object} currColumnConfig - Currently applied column configuration
 * @returns {Object} - Returns the updated column configuration
 */
export let updateColumnConfig = function( response, currColumnConfig ) {
    //update the current column config with new cols from response, but never reduce or change
    //because it changes the order, just add the additional cols
    let newColumnConfig = response.output.columnConfig;
    let newCurrColumnConfigCols = [ ...currColumnConfig.columns ];
    _.forEach( newColumnConfig.columns, function( existingColumnn ) {
        let obj = currColumnConfig.columns.find( o => o.propertyName === existingColumnn.propertyName );
        if( !obj ) {
            newCurrColumnConfigCols.push( existingColumnn );
        }
    } );
    currColumnConfig.columns = newCurrColumnConfigCols;
    return currColumnConfig;
};

/**
 * The method will pop up the Confirmation for dependent children on widget selection to let the user decide to continue or abort
 * in case of a widget lov change. Note that as we'll have multiple such scenarions the naming is generic and we'll add
 * differentiators to it as we add more such handlers.
 *
 * @param {object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {object} viewModelProp - view Model Prop
 */
export let leaveConfirmationForWidgetSelectionChange = function( widgetVmo, viewModelProp ) {
    if( !widgetVmo || !widgetVmo.children || widgetVmo.children.length === 0 ) {
        return;
    }
    let localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    let msg = localeTextBundle.confirmationToRemoveChildrenOnParentDataTypeChange;
    var cancelString = localeTextBundle.cancel;
    var proceedString = localeTextBundle.continue;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0VariabilityExplorerTree.reverseWidgetSelectionChange', {
                vmo: widgetVmo,
                viewModelProp: viewModelProp
            } );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0VariabilityExplorerTree.goAheadWidgetSelectionChange', {
                vmo: widgetVmo,
                viewModelProp: viewModelProp
            } );
        }
    }
    ];
    if( widgetVmo.props.object_name.dbValue ) {
        messagingService.showWarning( msg.replace( '{0}', widgetVmo.props.object_name.dbValue ), buttons );
    } else {
        messagingService.showWarning( msg.replace( '\"{0}\"', '' ), buttons );
    }
};

/**
 * Returns the parent element based on availability
 * @param {Object} commandContext - commandContext of the element
 * @param {Object} topTreeNode - topTreeNode of the element
 * @returns {Object} - Returns the parent element
 */
export let populateParentElement = function( commandContext, topTreeNode ) {
    if( commandContext.searchState && commandContext.searchState.update ) {
        let newsearchState = { ...commandContext.searchState.value };
        newsearchState.unsavedRows = true;
        commandContext.searchState.update( newsearchState );
    }
    return commandContext.selectionData === undefined ? commandContext.selected[ 0 ] : commandContext.selectionData.selected === undefined || commandContext.selectionData.selected.length === 0 ?
        topTreeNode.children[ 0 ] : commandContext.selectionData.selected[ 0 ];
};

/**
 * Removes the edit handler
 * this is important to do in a non inline authoring mode because keeping it around interfers with other areas
 * and it's not obvious it's because of this handler
 * @param {String} inlineAuthoringHandlerContext - the name of the inlineAuthoringHandlerContext
 * @param {Object} searchState - atomic data to update
 */
export let removeEditHandler = function( inlineAuthoringHandlerContext, searchState ) {
    if( searchState && searchState.update ) {
        let newsearchState = { ...searchState.value };
        newsearchState.unsavedRows = false;
        searchState.update( newsearchState );
    }

    var editHandler = editHandlerSvc.getEditHandler( inlineAuthoringHandlerContext ); //inlineAuthoringHandlerContext
    if( editHandler ) {
        editHandlerSvc.removeEditHandler( inlineAuthoringHandlerContext );
    }
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model or just the children
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns unsaved rows array
 */
export let discardAllUnsavedRows = function( unsavedRows, treeDataProvider ) {
    let newUnsavedRows = [ ...unsavedRows ];
    let loadedViewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( newUnsavedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            loadedViewModelObjects.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from chilren array of parent node
        let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
            if( parentVMO.children.length > 0 ) {
                let inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
                if( inlineRowIdxFromChildArray !== -1 ) {
                    parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
                }
            }
        }
    } );

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
    treeDataProvider.setSelectionEnabled( true );
    pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );

    //LCS-738746 - Save and Remove command enablement issue in Features Tab
    //set isInlineAuthoringMode to false after discarding
    let contextKey = veConstants.CONFIG_CONTEXT_KEY;
    appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', false );
    //set selection back to root
    let rootNodeIndex = 0;
    let parentNode = viewModelCollection.getViewModelObject( rootNodeIndex );
    treeDataProvider.selectionModel.setSelection( parentNode );
    return [];
};

/**
 * Checks if allowed to save, any empty required field triggers a false
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Boolean} - Returns true if allowed to save false otherwise
 */
export let isAllowedToSave = function( unsavedRows, treeDataProvider ) {
    let ret = true;
    let newUnsavedRows = [ ...unsavedRows ];
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( newUnsavedRows, function( inlineRow ) {
        if( ret ) {
            let inlineRowVmo = _getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
            _.forEach( inlineRowVmo.props, function( prop ) {
                if( ret && prop.isEditable && prop.isRequired && ( prop.dbValue === null || prop.dbValue === '' ) ) {
                    prop.isNotAllowedToSave = true;
                    ret = false;
                }
            } );
        }
    } );
    if( !ret ) {
        treeDataProvider.update( vmos );
    }
    return ret;
};

/**
 * selects the first UnsavedRow
 * @param {Object} unsavedRows - the array of unsaved rows
 * @param {object} treeDataProvider - the tree data provider
 */
export let selectFirstUnsavedRow = function( unsavedRows, treeDataProvider ) {
    if( !treeDataProvider || !unsavedRows || unsavedRows.length <= 0 ) {
        return;
    }
    let selectionMOList = [];
    // the first visible unsaved row will be the last added, set selection to it
    let uid = unsavedRows[ unsavedRows.length - 1 ].viewModelObject.uid;
    let selObj = _getInlineRowByUid( treeDataProvider, uid );
    selObj.alternateID = uid;
    selectionMOList.push( selObj );

    treeDataProvider.selectionModel.setSelection( selectionMOList );
};

/**
 * This method will update the cfg0MaximumValue and cfg0MinimumValue datatype based on Family data type changed from value datat type LOV
 *
 * @param {object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {object} treeDataProvider - Tree data provider
 */
export let updateMinMaxValueTypeBasedOnFamilyDataType = function( widgetVmo, treeDataProvider ) {
    if( widgetVmo ) {
        let updatePropValMap = {
            newValue: null,
            newDisplayValues: [],
            displayValues: [],
            dbValue: null,
            uiValue: '',
            isEnabled: true,
            type: ''
        };

        let widgetValueDataType = widgetVmo.props.cfg0ValueDataType.dbValue;

        // When we have widgetVmo valueDataType String or Integer, we update the propertyValueMap type from pca0Constants enumerated types array
        updatePropValMap.type = pca0Constants.FAMILY_VALUE_TYPES.find( enumType => enumType === widgetValueDataType ).toUpperCase();

        // Update all required values in propertyValMap for specific type as required for Floating Point, Date, and Boolean data types
        switch ( widgetValueDataType ) {
            case 'Floating Point':
                updatePropValMap.type = 'DOUBLE';
                break;
            case 'Date':
                for( let propName in widgetVmo.props ) {
                    if( widgetVmo.props.hasOwnProperty( propName ) ) {
                        let prop = widgetVmo.props[ propName ];
                        if( prop.dateApi ) {
                            prop.dateApi.isTimeEnabled = false;
                        }
                    }
                }
                break;
            case 'Boolean':
                updatePropValMap.type = 'STRING';
                updatePropValMap.isEnabled = false;
                break;
            default:
                break;
        }
        _updateMinMaxValueDataType( widgetVmo, updatePropValMap );
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects(), [ widgetVmo ] );
    }
};

/**
 * selects the next UnsavedRow
 * @param {Object} failedUnsavedRows - the array of unsaved rows
 * @param {object} treeDataProvider - the tree data provider
 */
export let selectNextUnsavedRow = function( failedUnsavedRows, treeDataProvider ) {
    if( !treeDataProvider || !failedUnsavedRows || failedUnsavedRows.length <= 0 ) {
        return;
    }
    //get current selection - if not an unsaved row, got to the first else determine the next
    let curSelection = treeDataProvider.selectionModel.getSelection();
    if( curSelection && curSelection[ 0 ] ) {
        let curUnsavedRowIndex = failedUnsavedRows.findIndex( function( inlineRow ) {
            return curSelection[ 0 ] === inlineRow.viewModelObject.uid;
        } );
        var previousUnsavedRow = failedUnsavedRows[ curUnsavedRowIndex < 1 ? failedUnsavedRows.length - 1 : curUnsavedRowIndex - 1 ];
        let selectionMOList = [];
        if( previousUnsavedRow ) {
            let selObj = _getInlineRowByUid( treeDataProvider, previousUnsavedRow.viewModelObject.uid );
            selectionMOList.push( selObj );
            treeDataProvider.selectionModel.setSelection( selectionMOList );
        }
    } else {
        exports.selectFirstUnsavedRow( failedUnsavedRows, treeDataProvider );
    }
};

/**
 * This function will call getAllocationObjects function in pca0ConfiguratorExplorerCommonUtils
 * @param {Object} soaResponse response from SOA
 * @param {Object} allocationObjects - the allocation object data
 * @returns {Object} - Returns the updated allocation object
 */
export let getAllocationObjectsFromInlineHandler = function( soaResponse, allocationObjects ) {
    return pca0ConfiguratorExplorerCommonUtils.getAllocationObjects( soaResponse, allocationObjects );
};

/**
 * This function will return the allocation UID by comparing UID of the object from the map
 * @param {Object} allocationObjects - the allocation objects
 * @param {Object} nodeUid - node uid of the object
 * @returns {Object} - Returns the allocation uid of the object
 */
export let getAllocationUid = function( allocationObjects, nodeUid ) {
    return _.get( allocationObjects, nodeUid );
};

/**
 * This function will create a new property and store the last two selected feature data type LOVs
 * @param {Object} widgetVmo - vmo of the selected row
 * @param {object} treeDataProvider - the tree data provider
 */
export let updatePreviousSelectedLovType = function( widgetVmo, treeDataProvider ) {
    let viewModelObjects = _.cloneDeep( treeDataProvider.getViewModelCollection().getLoadedViewModelObjects() );
    let nodeIndex = treeDataProvider.getViewModelCollection().findViewModelObjectById( widgetVmo.uid );
    //if the property in undefined we are populating the first index as 'String' by default else we are moving second index to first.
    if( widgetVmo.props.cfg0ValueDataType.previousSelectedLovs === undefined ) {
        let previousSelectedLovs = {
            uiValue: widgetVmo.props.cfg0ValueDataType.prevDisplayValues[ 0 ],
            dbValue: pca0Constants.FAMILY_VALUE_TYPES[ 3 ]
        };
        _.set( widgetVmo.props.cfg0ValueDataType, 'previousSelectedLovs', [ previousSelectedLovs ] );
    } else {
        widgetVmo.props.cfg0ValueDataType.previousSelectedLovs[ 0 ] = widgetVmo.props.cfg0ValueDataType.previousSelectedLovs[ 1 ];
    }
    //populating the second index from current selected LOV
    let latestSelectedLov = {
        uiValue: widgetVmo.props.cfg0ValueDataType.uiValue,
        dbValue: widgetVmo.props.cfg0ValueDataType.dbValue
    };
    widgetVmo.props.cfg0ValueDataType.previousSelectedLovs[ 1 ] = latestSelectedLov;
    viewModelObjects[ nodeIndex ] = widgetVmo;
    treeDataProvider.update( viewModelObjects );
};

/**
 * Returns the new row cache after a server call filled with the necessary info to retrieve the object types by the LOV Type component
 * in order to reuse the list of object types retrieved for a specific inline row type (group, family or feature)
 * @param {Object} objectTypesCacheMap - original objectTypesCacheMap
 * @param {String} boTypeName - the type we cache for
 * @param {Object} loadedObjectTypes - the list to reuse,
 * @param {String} uid - ther uid of the current obj
 * @param {Object} viewModelCollection -viewModelCollection,
 * @returns {Object} - Returns new row cache
 */
export let cacheLoadedObjectTypes = function( objectTypesCacheMap, boTypeName, loadedObjectTypes, uid, viewModelCollection ) {
    let newCacheMap = { ...objectTypesCacheMap };
    newCacheMap[ boTypeName ] = loadedObjectTypes;
    //also update the current inline row, so ti won't trigger another soa call
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    let nodeIndex = viewModelCollection.findViewModelObjectById( uid );
    if( viewModelObjects[ nodeIndex ] ) {
        viewModelObjects[ nodeIndex ].props.object_type.objectTypesCachedValues = loadedObjectTypes;
    }

    return newCacheMap;
};

/**
 * This function will create/update a new prop if the reuse mode is true or false
 */
export let updateReuseProp = function() {
    let context = null;
    context = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( context.reuseMode === undefined ) {
        _.set( context, 'reuseMode', true );
    } else{
        context.reuseMode = !context.reuseMode;
    }
    appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, context );
};

/**
 * LCS-757077 - BASH_Fall22:Issues with expand icon Issue-1
 * This function will remove the loading Status icon while authoring for cached data
 * Adding new function instead of doing in the same renderInlineRow function because it can fail due to timing issue
 * @param {String} treeDataProvider - treedataprovider
 * @param {Object} parentNode -Parent node,
 */
export let resetLoadingStatus = function( treeDataProvider, parentNode ) {
    let viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let expectedInlineRowIdx = viewModelObjects.indexOf( parentNode );
    if ( viewModelObjects[expectedInlineRowIdx].isCatched === true && viewModelObjects[expectedInlineRowIdx].children ) {
        viewModelObjects[expectedInlineRowIdx].loadingStatus = false;
    }
    treeDataProvider.update( viewModelObjects );
};


export default exports = {
    populateVisiblePropertyList,
    renderInlineRow,
    resetInlineDataCache,
    updateInlineRowVMOProperties,
    populateInlineRows,
    cancelEdits,
    saveEdits,
    postSaveHandler,
    cacheInlineRowFromServerResponse,
    removeUnsavedRow,
    removeSavedRowAndChildrenFromUi,
    removeInlineRowsAfterSave,
    updateColumnConfig,
    updateUnsavedRows,
    removeUnsavedChildrenForFamily,
    removeUnsavedChildrenAfterFamilyDataTypeChange,
    leaveConfirmationForWidgetSelectionChange,
    reverseDataTypefamilySelection,
    populateParentElement,
    removeEditHandler,
    discardAllUnsavedRows,
    selectFirstUnsavedRow,
    isAllowedToSave,
    updateMinMaxValueTypeBasedOnFamilyDataType,
    selectNextUnsavedRow,
    getAllocationObjectsFromInlineHandler,
    getAllocationUid,
    updatePreviousSelectedLovType,
    cacheLoadedObjectTypes,
    updateReuseProp,
    resetLoadingStatus
};
