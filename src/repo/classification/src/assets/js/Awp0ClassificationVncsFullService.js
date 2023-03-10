// Copyright (c) 2021 Siemens

/*eslint-disable jsx-a11y/no-noninteractive-element-interactions*/
/*eslint-disable react/no-children-prop*/

/*global
 define
 */

/**
 * Defines {@link Awp0ClassificationVncsFullService}
 *
 * @module js/Awp0ClassificationVncsFullService
 */
import _ from 'lodash';
import AwClsVncContainer from 'viewmodel/AwClsVncContainerViewModel';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import classifySvc from 'js/classifyService';
import classifyDefinesService from 'js/classifyDefinesService';
import clsTreeSvc from 'js/Awp0ClassificationTreeService';
import classifyUtils from 'js/classifyUtils';
import awIconSvc from 'js/awIconService';
import iconSvc from 'js/iconService';
import awTableSvc from 'js/awTableService';

/*
 * Generates the cells to be displayed in 'View' mode
 *
 * @param {Object} response - the SOA response
 */
export let handleSelectionChange = function( selectionData, parentSelectionData ) {
    let tempData = parentSelectionData;
};


/*
 * Generates the new selection.
 *
 * @param {Object} response - the SOA response
 */
export let handlePreviousSelectionMark = function( selected ) {
    if( !selected.value.previouslySelectedClassNode || selected.value.previouslySelectedClassNode !== selected.value.selectedClassNode ) {
        var tempClsState = { ...selected.value };
        tempClsState.previouslySelectedClassNode = selected.value.selectedClassNode;
        selected.update( tempClsState );
    }
};

/**
 * Populates change caused by changing releases selections.
 * @param {Object} selectedClass the current selected class
 * @param {SelectionModel} origSelected  the selection model that the selected class originated from.
 * @param {State} classifyState  the classifyState to be updated, if available.
 * @param {State} releasesOptions  the releases state that has been modified, that we are updating because of.
 * @param {String} searchString  the search string for the server call.
 */
export let respondToReleases = function( selectedClass, origSelected, classifyState, releasesOptions, searchString ) {
    var sortOptionVnc = classifyDefinesService.LOAD_CLASS_CHILDREN_ASC;
    selectedClass = null;
    if( releasesOptions && ( releasesOptions.releasesActive || releasesOptions.releasesString ) || searchString ) {
        fetchChildren( selectedClass, origSelected, sortOptionVnc, classifyState, searchString, releasesOptions );
    }
};

/**
 * Populates redirected VNC change.
 * @param {Object} selectedClass the current selected class
 * @param {Object} navigateState  the parent uid being navigated to.
 * @param {Object} tmpState  the established temporary state.
 */
let updateNavigateState = function( selectedClass, navigateState, tmpState ) {
    if ( !tmpState.vncUpdate ) {
        tmpState.selectedNode = selectedClass;
    } else {
        delete tmpState.vncUpdate;
    }
    navigateState.update( tmpState );
};

/**
 * Populates redirected VNC change.
 * @param {Object} selectionModel the selection model being used..
 * @param {Object} navigateState  the parent uid being navigated to.
 */
export let redirectVnc = function( selectionModel, navigateState ) {
    const selectedNode = { uid: navigateState.vncUpdate, displayName: navigateState.parentDisplayName, selected: true };
    const tmpState = { ...navigateState.value };
    if( selectedNode.uid === classifyDefinesService.ROOT_LEVEL_ID ) {
        let tmpModel = { ...selectionModel.value };
        tmpModel.selectedClassNode = { treeLoadResult: navigateState.originVNCs };
        selectionModel.update( tmpModel );
        tmpState.parent = '';
        tmpState.parentDisplayName = '';
        delete tmpState.selectedNode;
        delete tmpState.vncUpdate;
    } else{
        if( navigateState.vncUpdate ) {
            updateRoot( selectedNode, selectionModel );
        }
        delete tmpState.vncUpdate;
    }
    navigateState.update( tmpState );
};

/**
 * Populates suggested VNC information.
 * @param {Object} response Soa Response for selected class.
 * @param {Object} classifyState  Classify State to update with suggested class.
 */
export let setSuggestedClassification = function( response, classifyState ) {
    const tmpState = { ...classifyState.value };
    tmpState.suggestedClassIcoUID = response.clsObjectDefs[1].pop().clsObjects[0].clsObject.uid;
    if( tmpState.suggestedClassIcoUID ) {
        tmpState.expandToClass = tmpState.selectedSuggestion.uid;
    }
    classifyState.update( tmpState );
};

/**
 * Determines VNC visiblity
 * @param {Object} selected Selected node
 * @param {Object} classifyState  Classify State
 * @param {Object} vncsToDisplay Set of VNCs to display
 * @returns {Boolean} true or false
 */
let isVncVisible = function( selected, classifyState, vncsToDisplay ) {
    var isVncVisible = false;
    if( classifyState && classifyState.attrs && classifyState.attrs.length ) {
        isVncVisible = false;
    } else if( selected && vncsToDisplay && vncsToDisplay.length > 0 ) {
        isVncVisible = true;
    }
    return isVncVisible;
};

/**
 * Prepares data for consumption by VNC component.
 * @param {Object} response Array of class definition data.
 * @returns {Object[]} vncsToDisplay array of data that can be converted into viewModelObjects
 */
let setResponseInfo = function( response ) {
    return response.map( ( child ) => {
        if( child && !child.children && !child.isLeaf ) {
            //must have at least 1 child, even if that child is not known.
            child.valid = true;
        }
        return {
            className: child.displayName,
            classDescription: '',
            children: child.children,
            imageUrl: child.iconURL,
            typeIconFileUrl: [ child.iconURL ],
            type: child.type,
            uid: child.uid,
            indicators: [],
            cellProperties: [],
            parent_Id: child.parent_Id,
            classProbability: child.props ? child.props.classProbability : undefined,
            valid: child.valid
        };
    } );
};

/**
 * Identifies which VNC info to use. Resolves synchronization between selected class and VNC cards.
 * @param {ViewModelTreeNode} selectedClass selected class to use as reference point to fetch classification objects.
 * @param {SelectionModel} origSelected the selection model of which class is selected.
 * @param {Boolean} freshRun whether this is the first time the VNCs have been called.
 * @param {State} navigateState the navigate state to update, if available.
 * @param {State} classifyState the classify state to synchronize with, if available.
 * @param {Integer} sortOptionVnc what sort option to apply, if any.
 * @param {State} releasesOptions the release options state that has been modified by user.
 * @returns {ViewModelObject[]} vncsToDisplay list of view model objects with class data.
 */
let findVncsInfo = function( selectedClass, origSelected, freshRun, navigateState, classifyState, sortOptionVnc, releasesOptions ) {
    var vncsToDisplay;
    if( selectedClass ) {
        var response = {};
        if( selectedClass.treeLoadResult ) {
            if( selectedClass.treeLoadResult.parentNode ) {
                //If the current treeLoadResult, the results from a selection in the tree, has a children field...
                //Use those children as the source for the VNCs to create.
                response = selectedClass.treeLoadResult.parentNode.children;
                if( !response || !response.length && selectedClass.treeLoadResult.childNodes.length ) {
                    response = selectedClass.treeLoadResult.childNodes;
                }
            }
            if( !selectedClass.treeLoadResult.rootPathNodes ) {
                //If there are no root path nodes, assume that data is already in the right format.
                vncsToDisplay = selectedClass.treeLoadResult;
            } else {
                vncsToDisplay = response && setResponseInfo( response );
            }
        } else if ( selectedClass.children && ( !selectedClass.parent_Id || classifyState ) ) {
            vncsToDisplay = setResponseInfo( selectedClass.children );
        } else {
            /* Enables the VNCs to be fetched without the tree table. */
            if( freshRun && navigateState ) {
                //perform search
                vncsToDisplay = fetchChildren( selectedClass, origSelected, sortOptionVnc, classifyState, null, releasesOptions, navigateState );
            }
        }
    }
    return vncsToDisplay;
};


/**
 * Should be replaced by a soa call if render function can be removed and then have a function to do the post processing.
 * Fetches class data to be used for VNCs.
 * @param {ViewModelTreeNode} selected selected class to use as reference point to fetch classification objects.
 * @param {SelectionModel} origSelected the selection model used to derive the selected class.
 * @param {Integer} sortOptionVnc what sort option to apply, if any.
 * @param {State} classifyState the classify state to synchronize with, if available.
 * @param {String} searchString if fetching for a search, the string to use.
 * @param {State} releasesOptions the releases being applied, if any.
 * @param {State} navigateState the navigate state to update with parent information.
 * @returns {Object} response that could be utilized for rendering next layer of VNCs, formatted like tree.
 */
let fetchChildren = async( selected, origSelected, sortOptionVnc, classifyState, searchString, releasesOptions, navigateState ) => {
    return await fetchClassificationObjects( selected, sortOptionVnc, searchString, releasesOptions, navigateState ).then( ( response ) => {
        response = response.map( ( child ) => {
            const childProps = child.properties;
            var nameIdx = _.findIndex( childProps, function( prop ) {
                return 'CLASS_NAME' === prop.propertyId;
            } );
            var typeIdx = _.findIndex( childProps, function( prop ) {
                return 'CLASS_TYPE' === prop.propertyId;
            } );
            var idIdx = _.findIndex( childProps, function( prop ) {
                return 'CLASS_ID' === prop.propertyId;
            } );
            var name = childProps[ nameIdx ].values[ 0 ].displayValue;
            const type = childProps[ typeIdx ].values[ 0 ].displayValue;
            const id = childProps[ idIdx ].values[ 0 ].displayValue;
            name = classifySvc.modifyForReleaseName( releasesOptions, child, name );
            var parent = classifyDefinesService.ROOT_LEVEL_ID;
            var parentDisplayName = '';
            if( child.parent_Id ) {
                parent = child.parent_Id;
            }
            if ( child.parentDisplayName ) {
                parentDisplayName = child.parentDisplayName;
            }
            var image = 'typeClassificationElement48.svg';
            image = iconSvc.getTypeIconFileUrl( image );
            if( child.documents && child.documents.length ) {
                if( child.documents[ 0 ].documentType === 'icon' || child.documents[ 0 ].documentType === 'image' ) {
                    const ticket = child.documents[ 0 ].ticket;
                    if ( ticket && classifyUtils.isSupportedImageType( ticket ) ) {
                        image = awIconSvc.buildThumbnailFileUrlFromTicket( ticket );
                    }
                }
            }
            return {
                className: name,
                classDescription: '',
                children: [],
                imageUrl: image,
                typeIconFileUrl: [ image ],
                type: type,
                uid: id,
                indicators: [],
                cellProperties: {
                    parent_Id: parent,
                    parentDisplayName: parentDisplayName
                }
            };
        } );
        response = {
            treeLoadResult: response
        };
        updateRoot( response, origSelected, classifyState );
        return response;
    } );
};


/**
 * Asynchronous function that performs the soa call for fetchChildren.
 * @param {ViewModelTreeNode} selectedClass selected class to use as reference point to fetch classification objects.
 * @param {Integer} sortOptionVnc what sort option to apply, if any.
 * @param {String} searchString if fetching for a search, the string to use.
 * @param {State} releasesOptions the releases to use, if any.
 * @param {State} navigateState if in classification location, the navigation state for the navigator panel.
 * @returns {Object} promise that evaluates to results from findClassificationInfo3.
 */
let fetchClassificationObjects = function( selectedClass, sortOptionVnc, searchString, releasesOptions, navigateState ) {
    var searchCriteria = {};
    var defaultFetch = false;
    //when all releases are selected, default tree should be shown
    if ( releasesOptions && releasesOptions.releasesActive === false ) {
        releasesOptions.releasesString = '';
    }
    if( releasesOptions ) {
        var releasesActive = releasesOptions.releasesString !== '' && releasesOptions.releasesString !== undefined;
    }

    if( searchString || releasesActive && !( navigateState && ( navigateState.selectedNode || selectedClass ) ) ) {
        if( searchString ) {
            searchCriteria.searchAttribute = classifySvc.UNCT_CLASS_NAME;

            searchCriteria.searchString = '*' + searchString + '*';
        }
        if( releasesActive ) {
            if( !searchCriteria.searchString ) {
                searchCriteria.searchString = 'ICM';
            }
            searchCriteria.searchString += releasesOptions.releasesString;
            searchCriteria.searchAttribute = 'CLASSID_SOURCESTANDARD';
        }
    } else if ( selectedClass ) {
        searchCriteria.searchAttribute = classifySvc.UNCT_CLASS_ID;
        searchCriteria.searchString = selectedClass.uid;
    } else {
        //If search string is blank but we're still rendering classification objects, reset area.
        searchCriteria.searchAttribute = classifySvc.UNCT_CLASS_ID;
        searchCriteria.searchString = 'ICM';
        defaultFetch = true;
    }
    searchCriteria.sortOption = classifySvc.UNCT_SORT_OPTION_CLASS_ID;
    let deferred = AwPromiseService.instance.defer();

    var request = {
        workspaceObjects: [],
        searchCriterias: [ searchCriteria ],
        classificationDataOptions: sortOptionVnc
    };
    soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then(
        function( response ) {
            var classParents = response.classParents;
            var idIdx;
            if ( classParents ) {
                for ( let key of Object.keys( classParents ) ) {
                    if( response.classChildren[key] ) {
                        if( selectedClass ) {
                            response.classChildren[key].parent_Id = selectedClass.uid;
                            response.classChildren[key].parentDisplayName = selectedClass.displayName;
                        } else {
                            response.classChildren[key].parent_Id = classifyDefinesService.ROOT_LEVEL_ID;
                        }
                    }
                    if ( navigateState ) {
                        var tmpNavState = { ...navigateState.value };
                        if( classParents[key].parents[0] ) {
                            idIdx = _.findIndex( classParents[key].parents[0].properties, function( prop ) {
                                return 'CLASS_ID' === prop.propertyId;
                            } );
                            tmpNavState.parent = classParents[key].parents[0].properties[idIdx].values[0].internalValue;
                            var nameIdx = _.findIndex( classParents[key].parents[0].properties, function( prop ) {
                                return 'CLASS_NAME' === prop.propertyId;
                            } );
                            tmpNavState.parentDisplayName = classParents[key].parents[0].properties[nameIdx].values[0].internalValue;
                        } else {
                            tmpNavState.parent = classifyDefinesService.ROOT_LEVEL_ID;
                            tmpNavState.parentDisplayName = classifyDefinesService.ROOT_LEVEL_ID;
                        }
                        if( !tmpNavState.parent ) {
                            tmpNavState.parent = classifyDefinesService.ROOT_LEVEL_ID;
                            tmpNavState.parentDisplayName = classifyDefinesService.ROOT_LEVEL_ID;
                        }
                        updateNavigateState( selectedClass, navigateState, tmpNavState );
                    }
                }
            }
            if ( response.classChildren && response.classChildren[ searchCriteria.searchString ] ) {
                if( response.classChildren[ searchCriteria.searchString ].parent_Id ) {
                    for( let child of response.classChildren[ searchCriteria.searchString ].children ) {
                        child.parent_Id = response.classChildren[ searchCriteria.searchString ].parent_Id;
                    }
                }
                if( response.classChildren[ searchCriteria.searchString ].parentDisplayName ) {
                    for( let child of response.classChildren[ searchCriteria.searchString ].children ) {
                        child.parentDisplayName = response.classChildren[ searchCriteria.searchString ].parentDisplayName;
                    }
                }
                response = response.classChildren[ searchCriteria.searchString ].children;
            } else if ( searchString ) {
                var newResponse = [];
                if ( classParents ) {
                    for ( let key of Object.keys( classParents ) ) {
                        if ( classParents[key].parents[0] ) {
                            if( response.clsClassDescriptors[key] ) {
                                idIdx = _.findIndex( classParents[key].parents[0].properties, function( prop ) {
                                    return 'CLASS_ID' === prop.propertyId;
                                } );
                                response.clsClassDescriptors[key].parent_Id = classParents[key].parents[0].properties[idIdx].values[0].internalValue;
                                var nameIdx = _.findIndex( classParents[key].parents[0].properties, function( prop ) {
                                    return 'CLASS_NAME' === prop.propertyId;
                                } );
                                response.classChildren[key].parentDisplayName = classParents[key].parents[0].properties[nameIdx].values[0].internalValue;
                            } else {
                                if( selectedClass && key !== selectedClass.uid ) {
                                    response.classChildren[key].parent_Id = selectedClass.uid;
                                    response.classChildren[key].parentDisplayName = selectedClass.displayName;
                                } else {
                                    response.classChildren[key].parent_Id = classifyDefinesService.ROOT_LEVEL_ID;
                                }
                            }
                        }
                    }
                }
                _.forEach( response.clsClassDescriptors, function( searchResult ) {
                    newResponse.push( searchResult );
                } );
                response = newResponse;
            } else if ( defaultFetch || !searchString && !selectedClass  ) {
                //Fetch default classes.
                if( releasesActive ) {
                    var releasesResponse = [];
                    _.forEach( response.clsClassDescriptors, function( searchResult ) {
                        releasesResponse.push( searchResult );
                    } );
                    response = releasesResponse;
                } else {
                    response = response.classChildren.Cls0DefaultView.children;
                }
            }else {
                response = [];
            }
            deferred.resolve( response );
        } ).catch( function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * Synchronization between VNCs and any other location, including next layer of VNCs. Occurs when user clicks a VNC.
 * Depends on classifyTreeService's updateSelectedClassNode for synching.
 * @param {ViewModelObject} label selected class to set as current.
 * @param {SelectionModel} selected the selection model used for synchronization.
 * @param {State} classifyState the classify state to synchronize with, if available.
 */
let updateRoot = ( label, selected, classifyState ) => {
    let childCount;
    if( selected.selectedClassNode &&
        selected.selectedClassNode.treeLoadResult &&
        selected.selectedClassNode.treeLoadResult.childNodes
    ) {
        var childNodes = selected.selectedClassNode.treeLoadResult.childNodes;

        childNodes.forEach( attr => {
            if ( attr.id === label.uid ) {
                childCount = attr.childCount;
            }
        } );
    }
    if ( classifyState && label && label.uid ) {
        const tmpState1 = { ...classifyState.value };
        //The two 0's here are wrong. Don't think it will hurt anything. I am not receiving the correct data from the treeTable to satisfy those two conditions.
        var newTreeNode = awTableSvc.createViewModelTreeNode( label.uid, label.type, label.displayName, 0, 0, label.iconURL );
        newTreeNode.isLeaf = true;
        newTreeNode.childCount = childCount;
        if( label.cellProperties ) {
            newTreeNode.parent_Id = label.cellProperties.parent_Id;
            newTreeNode.parentDisplayName = label.cellProperties.parentDisplayName;
        }
        if( label.props ) {
            newTreeNode.classProbability = label.props.classProbability;
            if( !newTreeNode.childCount ) {
                newTreeNode.childCount = label.props.childCount;
            }
        }
        if( !newTreeNode.classProbability ) {
            tmpState1.selectedNode = newTreeNode;
        } else {
            tmpState1.selectedSuggestion = newTreeNode;
            tmpState1.editClassCmd = {
                targetClassID: newTreeNode.uid
            };
        }
        classifyState.update( tmpState1 );
    }
    if( selected.update ) {
        clsTreeSvc.updateSelectedClassNode( label, selected, null );
    } else {
        clsTreeSvc.updateSelectedClassNode( label, classifyState, null );
    }
};

/**
 * render function for Awp0ClassificationVncsFullService. add a field to classify state
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const Awp0ClassificationVncsFullRenderFunction = ( props ) => {
    const { fields, selected, classifystate, navigateState, releasesState, ...prop } = props;
    var selectedClass;
    var sortOptionVnc = classifyDefinesService.LOAD_CLASS_CHILDREN_ASC;
    var freshRun = true;
    /**
     *  Prepare icos for display in the VNC container.
     * @param {ViewModelObject} simpleVmo the vmo to update
     * @return {ViewModelObject} response the prepared vmo.
     */
    let prepareVmo = function( simpleVmo ) {
        var response = {};
        response = {
            cellHeader1: simpleVmo.className,
            cellHeader2: simpleVmo.className,
            cellProperties: simpleVmo.cellProperties,
            thumbnailURL: simpleVmo.imageUrl,
            type: simpleVmo.type,
            typeIconUrl: simpleVmo.imageUrl,
            hasThumbnail: simpleVmo.iconAvailable,
            identifier: simpleVmo.uid,
            indicators: simpleVmo.indicators,
            navigation: '',
            props: {
                classDescription: simpleVmo.classDescription,
                children: simpleVmo.children,
                typeIconFileUrl: simpleVmo.imageUrl,
                classProbability: simpleVmo.classProbability,
                valid: simpleVmo.valid
            }
        };
        return response;
    };

    const linkFunc = ( vncsToDisplay, origSelected, classifyState ) => {
        if( vncsToDisplay ) {
            var response = [];
            vncsToDisplay.map( ( unrenderedChild ) => {
                var preparedVmo = prepareVmo( unrenderedChild );
                const handleClick = ( event ) => {
                    if( event.key && ( event.key !== 'Enter' && event.key !== ' ' ) ) { return; }
                    event.preventDefault();
                    var rootUpdater = {
                        uid: preparedVmo.identifier,
                        type: preparedVmo.type,
                        displayName: preparedVmo.cellHeader1,
                        iconUrl: preparedVmo.typeIconUrl,
                        parent_Id: preparedVmo.cellProperties.parent_Id,
                        selected: true,
                        props: {
                            classProbability: preparedVmo.props.classProbability,
                            parentDisplayName: preparedVmo.cellProperties.parentDisplayName,
                            childCount: preparedVmo.props.children ? preparedVmo.props.children.length : 0
                        }
                    };
                    if( preparedVmo.props.valid && !rootUpdater.props.childCount ) {
                        rootUpdater.props.childCount++;
                    }
                    if( !rootUpdater.parent_Id ) {
                        rootUpdater.parent_Id = classifyDefinesService.ROOT_LEVEL_ID;
                        rootUpdater.parentDisplayName = classifyDefinesService.ROOT_LEVEL_ID;
                    }
                    updateRoot( rootUpdater, origSelected, classifyState );
                };
                response.push(
                    // FIXME for className='flex-wrap justify-justified sw-vnc-container-listitem', non-interactive elements should
                    // not be assigned mouse or keyboard event listeners.
                    // FIXME for AwClsVncContainer vmo={preparedVmo}, do not pass children as props. Instead, nest children between
                    // opening and closng tags
                    <li key={preparedVmo.identifier} className='flex-wrap justify-justified sw-vnc-container-listitem' onClick={handleClick} onKeyDown={handleClick}>
                        <AwClsVncContainer vmo={preparedVmo} root={fields.rootstate} children={preparedVmo.props.children}/>
                    </li> );
            } );
            return response;
        }
    };

    if( selected && selected.value ) {
        if( selected.value.selectedClassNode ) {
            selectedClass = selected.value.selectedClassNode;
            if( selected.value.previouslySelectedClassNode && selected.value.previouslySelectedClassNode === selectedClass ) {
                freshRun = false;
            }
        } else {
            if( selected.value.selected ) {
                selectedClass = selected.value.selected[ 0 ];
            }
        }
    }

    if( classifystate && classifystate.value && classifystate.value.sortOption ) {
        sortOptionVnc = classifystate.value.sortOption;
    }

    if( classifystate && classifystate.selectedClassNode && classifystate.selectedClassNode.userReset && !selected.value.selected.length && !selected.value.selectedClassNode ) {
        selectedClass = classifystate.selectedClassNode;
    }

    var vncsToDisplay = findVncsInfo( selectedClass, selected, freshRun, navigateState, classifystate, sortOptionVnc, releasesState );
    /* Enables the VNCs to be fetched without the tree table. */
    if( navigateState && !selectedClass ) {
        //perform search
        var searchString;
        if( navigateState ) {
            searchString = navigateState.searchCriteria;
        }
        vncsToDisplay = fetchChildren( selectedClass, selected, sortOptionVnc, classifystate, searchString, releasesState );
    }

    return (
        <ul className='w-12 flex-wrap justify-center aw-layout-flexRowContainer'>
            { isVncVisible( selected, classifystate, vncsToDisplay ) && linkFunc( vncsToDisplay, selected, classifystate ) }
        </ul>
    );
};
