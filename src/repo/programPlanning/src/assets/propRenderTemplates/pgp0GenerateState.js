// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/pgp0GenerateState
 * @requires app
 */
import { getBaseUrlPath } from 'app';
import ppConstants from 'js/ProgramPlanningConstants';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

/*
 * @param { Object } vmo - ViewModelObject for which release status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let pgpStateRendererFn = function( vmo, containerElem, property ) {
    let cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-visual-indicator';
    let imagePath = getBaseUrlPath() + '/image/';

    let uid = vmo.uid;
    if( vmo.modelType && vmo.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) >= 0 ) {
        uid = vmo.props.awp0Target.dbValues[ 0 ];
    }
    //For Compare tab in VMO all selected objects are coming along with transposedColumnProperty and uid in property
    if( uid === undefined && vmo.props.transposedColumnProperty ) {
        uid = property;
    }
    let object = cdm.getObject( uid );
    //For Criteria object
    if( object.modelType.typeHierarchyArray.indexOf( 'Prg0AbsCriteria' ) >= 0 ) {
        let stateName = vmo.props.fnd0State.dbValue;
        let stateToolTip = vmo.props.fnd0State.uiValue;

        cellImg.title = stateToolTip;

        if( stateName === 'In Process' ) {
            stateName = 'InProcess';
        }

        if( ppConstants.CRITERIA_STATE[ stateName ] ) {
            imagePath += ppConstants.CRITERIA_STATE[ stateName ];

            cellImg.src = imagePath;
            containerElem.appendChild( cellImg );
        }
    } else if( object.modelType.typeHierarchyArray.indexOf( 'Prg0AbsEvent' ) >= 0 ) { //For Event object
        let stateValue = getState( vmo, object );
        let dbValue = stateValue[0];
        let displayValue = stateValue[1];
        cellImg.title = displayValue;
        if( ppConstants.EVENT_STATE[ dbValue ] ) {
            imagePath += ppConstants.EVENT_STATE[ dbValue ];
            cellImg.src = imagePath;
            containerElem.appendChild( cellImg );
        }
    } else {
        if( cmm.isInstanceOf( 'Prg0AbsPlan', object.modelType ) && object.props.prg0State ) {
            let stateValue = getState( vmo, object );
            let dbValue = stateValue[0];
            let displayValue = stateValue[1];
            let childElement = getContainerElement( dbValue, displayValue, ppConstants.PROGRAM_STATE );
            containerElem.appendChild( childElement );
        } else {
            let displayValue = '';
            if( property && object.props[ property ] ) {
                displayValue = object.props[ property ].uiValues;
            }
            if( displayValue !== '' ) {
                let childElement = document.createElement( 'div' );
                childElement.className = 'aw-splm-tableCellText';
                childElement.innerHTML += displayValue;
                containerElem.appendChild( childElement );
            }
        }
    }
};

let getState = function( vmo, object ) {
    let dbValue;
    let displayValue;
    if( !vmo.props ||  !vmo.props.prg0State ) {
        dbValue = object.props.prg0State.dbValues[0];
        displayValue = object.props.prg0State.uiValues[0];
    }else{
        dbValue = vmo.props.prg0State.dbValue;
        displayValue = vmo.props.prg0State.uiValue;
    }

    if( dbValue === 'Not Started' ) {
        dbValue = 'NotStarted';
    }
    if( dbValue === 'In Progress' ) {
        dbValue = 'InProgress';
    }
    return [ dbValue, displayValue ];
};

let getContainerElement = function( internalName, dispName, constantMap ) {
    let childElement = document.createElement( 'div' );
    if( constantMap[ internalName ] ) {
        let imageElement = document.createElement( 'img' );
        imageElement.className = 'aw-visual-indicator';
        let imagePath = getBaseUrlPath() + '/image/';
        imageElement.title = dispName;
        imagePath += constantMap[ internalName ];
        imageElement.src = imagePath;
        imageElement.alt = dispName;
        childElement.appendChild( imageElement );
    }
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += dispName;
    return childElement;
};

export default exports = {
    pgpStateRendererFn
};
