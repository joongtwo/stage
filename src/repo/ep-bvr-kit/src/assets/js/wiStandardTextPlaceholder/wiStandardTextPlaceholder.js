//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Placeholder plugin for standard text element
 */
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';

const STANDARD_TEXT_ELEMENT = 'stx';
const DIVISION_ELEMENT = 'div';

const STANDARD_TEXT_PLACEHOLDER_CLASS = 'aw-epInstructionsEditor-standardTextPlaceholder';

export default class WIStandardTextPlaceholder extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }
    init() {
        this._defineSchema();
        this._defineConverters();
        this.editor.editing.mapper.on(
            'viewToModelPosition',
            ckeditor5ServiceInstance.viewToModelPositionOutsideModelElement(
                this.editor.model, viewElement => viewElement.hasClass( STANDARD_TEXT_PLACEHOLDER_CLASS ) )
        );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( STANDARD_TEXT_ELEMENT, {
            allowWhere: '$block',
            isObject: true,
            allowAttributes: [ 'uid', 'name' ]
        } );

        schema.register( DIVISION_ELEMENT, {
            allowIn: STANDARD_TEXT_ELEMENT,
            isLimit: true,
            allowAttributes: [ 'content' ]
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: STANDARD_TEXT_ELEMENT,
                classes: [ STANDARD_TEXT_PLACEHOLDER_CLASS ]
            },
            model: ( viewElement, { writer: modelWriter } ) => {
                const uid = viewElement._attrs.get( 'uid' );
                const name = viewElement._attrs.get( 'name' );

                return modelWriter.createElement( STANDARD_TEXT_ELEMENT, { uid, name } );
            }
        } );
        conversion.for( 'dataDowncast' ).elementToElement( {
            model: STANDARD_TEXT_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => createStxPlaceholderView( modelItem, viewWriter )
        } );
        conversion.for( 'editingDowncast' ).elementToElement( {
            model: STANDARD_TEXT_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => {
                const widgetElement = createStxPlaceholderView( modelItem, viewWriter );
                return ckeditor5ServiceInstance.toWidget( widgetElement, viewWriter );
            }
        } );
        conversion.for( 'upcast' ).elementToElement( {
            view: {
                name: DIVISION_ELEMENT
            },
            model: ( viewElement, { writer: modelWriter } ) => {
                const content = viewElement.getChild( 0 ).data;

                return modelWriter.createElement( DIVISION_ELEMENT, { content, bold: true } );
            }
        } );

        conversion.for( 'editingDowncast' ).elementToElement( {
            model: DIVISION_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => {
                return createPlaceholderView( modelItem, viewWriter );
            }
        } );

        conversion.for( 'dataDowncast' ).elementToElement( {
            model: DIVISION_ELEMENT,
            view: ( modelItem, { writer: viewWriter } ) => createPlaceholderView( modelItem, viewWriter )
        } );

        /**
         * 
         * @param {Object} modelItem model item
         * @param {Object} viewWriter view writer
         * @returns {object} placeholder view
         */
        function createStxPlaceholderView( modelItem, viewWriter ) {
            const uid = modelItem.getAttribute( 'uid' );
            const name = modelItem.getAttribute( 'name' );


            return viewWriter.createContainerElement( STANDARD_TEXT_ELEMENT, {
                class: STANDARD_TEXT_PLACEHOLDER_CLASS,
                uid: uid,
                name: name
            } );
        }
        /**
         * 
         * @param {Object} modelItem model item
         * @param {Object} viewWriter view writer
         * @returns {object} placeholder view
         */
        function createPlaceholderView( modelItem, viewWriter ) {
            const content = modelItem.getAttribute( 'content' );

            const placeholderView = viewWriter.createContainerElement( DIVISION_ELEMENT, {
                style: 'font-weight: bold'
            }, {
                isAllowedInsideAttributeElement: true
            } );

            const innerText = viewWriter.createText(  content  );
            viewWriter.insert( viewWriter.createPositionAt( placeholderView, 0 ), innerText );

            return placeholderView;
        }
    }
}


