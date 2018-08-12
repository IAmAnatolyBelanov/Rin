import * as monacoEditor from 'monaco-editor';
import { Pivot, PivotItem } from 'office-ui-fabric-react';
import * as React from 'react';
import { ObjectInspector } from 'react-inspector';
import MonacoEditor from 'react-monaco-editor';
import { BodyDataPayload, RequestRecordDetailPayload } from '../../api/IRinCoreHub';
import { getContentType, getMonacoLanguage, isImage, isJson, isText } from '../../utilities';
import { KeyValueDetailList } from '../shared/KeyValueDetailList';

export interface IInspectorRequestResponseViewProps {
  record: RequestRecordDetailPayload;
  generals: { key: string; value: string }[];
  headers: { [key: string]: string[] };
  body: BodyDataPayload | null;
}

export class InspectorDetailRequestResponseView extends React.Component<
  IInspectorRequestResponseViewProps,
  { bodyView: 'Tree' | 'Source' }
> {
  constructor(props: IInspectorRequestResponseViewProps) {
    super(props);
    this.state = {
      bodyView: 'Source'
    };
  }

  componentWillReceiveProps() {
    const contentType = this.props.record.IsCompleted && getContentType(this.props.headers);
    if (!(contentType && isJson(contentType) && this.state.bodyView === 'Tree')) {
      this.setState({ bodyView: 'Source' });
    }
  }

  render() {
    const contentType = this.props.record.IsCompleted
      ? this.props.body != null && this.props.body.PresentationContentType !== ''
        ? this.props.body.PresentationContentType
        : getContentType(this.props.headers)
      : null;
    const isTransformed = this.props.body != null && this.props.body.PresentationContentType !== '';
    const body =
      this.props.body != null
        ? this.props.body.IsBase64Encoded
          ? atob(this.props.body.Body)
          : this.props.body.Body
        : '';
    const hasBody = this.props.body != null;

    return (
      <div className="inspectorRequestResponseView">
        <div className="inspectorRequestResponseView_General">
          {this.props.generals != null &&
            this.props.generals.length > 0 && (
              <KeyValueDetailList keyName="Name" valueName="Value" items={this.props.generals} />
            )}
        </div>
        <div className="inspectorRequestResponseView_Headers">
          <KeyValueDetailList
            keyName="Header"
            valueName="Value"
            items={Object.keys(this.props.headers).map(x => ({
              key: x,
              value: this.props.headers[x].join('\n')
            }))}
          />
        </div>
        <div className="inspectorRequestResponseView_Body">
          {hasBody &&
            contentType &&
            this.canPreview(contentType) && (
              <>
                <Pivot selectedKey={this.state.bodyView} onLinkClick={this.onBodyPivotItemClicked}>
                  {isJson(contentType) ? <PivotItem itemKey="Tree" headerText="Tree" itemIcon="RowsChild" /> : <></>}
                  <PivotItem
                    itemKey="Source"
                    headerText={isTransformed ? `View as ${contentType}` : 'Source'}
                    itemIcon="Code"
                  />
                </Pivot>
                {this.state.bodyView === 'Tree' && (
                  <div className="inspectorRequestResponseViewObjectInspector">
                    <ObjectInspector data={JSON.parse(body)} />
                  </div>
                )}
                {this.state.bodyView === 'Source' && (
                  <>
                    {isText(contentType) && <EditorPreview contentType={contentType} body={body} />}
                    {isImage(contentType) && (
                      <ImagePreview contentType={contentType} bodyAsBase64={this.props.body!.Body} />
                    )}
                  </>
                )}
              </>
            )}
        </div>
      </div>
    );
  }

  private canPreview(contentType: string) {
    return isJson(contentType) || isText(contentType) || isImage(contentType);
  }

  private onBodyPivotItemClicked = (item: PivotItem) => {
    this.setState({ bodyView: item.props.itemKey as 'Tree' | 'Source' });
  };
}

class EditorPreview extends React.Component<{ contentType: string; body: string }, {}> {
  private unsubscribe: () => void;
  private editor: monacoEditor.editor.IStandaloneCodeEditor;

  componentDidMount() {
    const listener = () => {
      this.editor.layout({ width: 0, height: 0 });
    };

    window.addEventListener('resize', listener);
    this.unsubscribe = () => window.removeEventListener('resize', listener);

    // force re-layout
    this.editor.layout({ width: 0, height: 0 });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  editorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
    this.editor = editor;
  };

  render() {
    return (
      <MonacoEditor
        width="100%"
        height="100%"
        options={{ readOnly: true, automaticLayout: true, wordWrap: 'on' }}
        language={getMonacoLanguage(this.props.contentType)}
        value={this.props.body}
        editorDidMount={this.editorDidMount}
      />
    );
  }
}

class ImagePreview extends React.Component<
  { contentType: string; bodyAsBase64: string },
  { width: number; height: number; loaded: boolean }
> {
  private imagePreview = React.createRef<HTMLImageElement>();

  constructor(props: { contentType: string; bodyAsBase64: string }) {
    super(props);

    this.state = {
      width: 0,
      height: 0,
      loaded: false
    };
  }

  componentDidMount() {
    this.imagePreview.current!.addEventListener('load', this.onImageLoad);
  }

  componentWillUnmount() {
    this.imagePreview.current!.removeEventListener('load', this.onImageLoad);
  }

  componentWillReceiveProps() {
    this.setState({ loaded: false });
  }

  render() {
    return (
      <div className="inspectorRequestResponseViewImagePreview">
        <figure>
          <div className="inspectorRequestResponseViewImagePreview_Image">
            <img
              ref={this.imagePreview}
              src={'data:' + this.props.contentType + ';base64,' + this.props.bodyAsBase64}
            />
          </div>
          <figcaption>
            {this.state.loaded && (
              <>
                {this.state.width} x {this.state.height} |
              </>
            )}{' '}
            {this.props.contentType}
          </figcaption>
        </figure>
      </div>
    );
  }

  private onImageLoad = () => {
    const imageE = this.imagePreview.current!;
    this.setState({
      loaded: true,
      width: imageE.naturalWidth,
      height: imageE.naturalHeight
    });
  };
}
