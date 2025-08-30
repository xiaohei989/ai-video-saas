import React from 'react'
import {
  List,
  Datagrid,
  TextField,
  DateField,
  BooleanField,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  SearchInput,
  ShowButton,
  EditButton,
  DeleteButton,
} from 'react-admin'

const FAQFilters = [
  <SearchInput source="q" placeholder="搜索FAQ" alwaysOn />,
  <SelectInput
    source="category"
    choices={[
      { id: 'technical', name: '技术问题' },
      { id: 'billing', name: '计费问题' },
      { id: 'account', name: '账户问题' },
      { id: 'feature_request', name: '功能请求' },
      { id: 'other', name: '其他' },
    ]}
    label="分类"
  />,
  <BooleanInput source="is_active" label="启用状态" />,
]

export const FAQList: React.FC = () => (
  <List filters={FAQFilters}>
    <Datagrid rowClick="edit">
      <TextField source="question" label="问题" />
      <TextField source="category" label="分类" />
      <TextField source="language" label="语言" />
      <BooleanField source="is_active" label="启用" />
      <DateField source="created_at" label="创建时间" />
      <ShowButton />
      <EditButton />
      <DeleteButton />
    </Datagrid>
  </List>
)

export const FAQEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="question" label="问题" required multiline />
      <TextInput source="answer" label="答案" required multiline rows={4} />
      <SelectInput
        source="category"
        choices={[
          { id: 'technical', name: '技术问题' },
          { id: 'billing', name: '计费问题' },
          { id: 'account', name: '账户问题' },
          { id: 'feature_request', name: '功能请求' },
          { id: 'other', name: '其他' },
        ]}
        label="分类"
        required
      />
      <SelectInput
        source="language"
        choices={[
          { id: 'zh', name: '中文' },
          { id: 'en', name: 'English' },
          { id: 'ja', name: '日本語' },
          { id: 'ko', name: '한국어' },
          { id: 'es', name: 'Español' },
        ]}
        label="语言"
        required
      />
      <BooleanInput source="is_active" label="启用状态" />
    </SimpleForm>
  </Edit>
)

export const FAQCreate: React.FC = () => (
  <Create>
    <SimpleForm>
      <TextInput source="question" label="问题" required multiline />
      <TextInput source="answer" label="答案" required multiline rows={4} />
      <SelectInput
        source="category"
        choices={[
          { id: 'technical', name: '技术问题' },
          { id: 'billing', name: '计费问题' },
          { id: 'account', name: '账户问题' },
          { id: 'feature_request', name: '功能请求' },
          { id: 'other', name: '其他' },
        ]}
        label="分类"
        required
      />
      <SelectInput
        source="language"
        choices={[
          { id: 'zh', name: '中文' },
          { id: 'en', name: 'English' },
        ]}
        label="语言"
        required
        defaultValue="zh"
      />
      <BooleanInput source="is_active" label="启用状态" defaultValue={true} />
    </SimpleForm>
  </Create>
)