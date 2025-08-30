import React from 'react'
import {
  List,
  Datagrid,
  TextField,
  DateField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  SearchInput,
  TopToolbar,
  FilterButton,
  useRecordContext,
  ChipField,
  ReferenceField,
  ReferenceManyField,
  ShowButton,
  EditButton,
} from 'react-admin'

const TicketFilters = [
  <SearchInput source="q" placeholder="搜索工单" alwaysOn />,
  <SelectInput
    source="status"
    choices={[
      { id: 'open', name: '未处理' },
      { id: 'in_progress', name: '处理中' },
      { id: 'waiting_user', name: '等待用户' },
      { id: 'resolved', name: '已解决' },
      { id: 'closed', name: '已关闭' },
    ]}
    label="状态"
  />,
]

export const TicketList: React.FC = () => (
  <List filters={TicketFilters} sort={{ field: 'created_at', order: 'DESC' }}>
    <Datagrid rowClick="show">
      <TextField source="ticket_number" label="工单号" />
      <TextField source="subject" label="标题" />
      <ChipField source="status" label="状态" />
      <TextField source="priority" label="优先级" />
      <ReferenceField source="user_id" reference="users" label="用户">
        <TextField source="username" />
      </ReferenceField>
      <DateField source="created_at" label="创建时间" showTime />
      <ShowButton />
      <EditButton />
    </Datagrid>
  </List>
)

export const TicketShow: React.FC = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="ticket_number" label="工单号" />
      <TextField source="subject" label="标题" />
      <TextField source="status" label="状态" />
      <TextField source="priority" label="优先级" />
      <DateField source="created_at" label="创建时间" showTime />
    </SimpleShowLayout>
  </Show>
)

export const TicketEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <SelectInput
        source="status"
        choices={[
          { id: 'open', name: '未处理' },
          { id: 'in_progress', name: '处理中' },
          { id: 'resolved', name: '已解决' },
          { id: 'closed', name: '已关闭' },
        ]}
      />
    </SimpleForm>
  </Edit>
)