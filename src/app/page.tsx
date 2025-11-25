'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Table,
  Badge,
  Group,
  Stack,
  Paper,
  Modal,
  TextInput,
  Select,
  NumberInput,
  Switch,
  Textarea,
  Alert,
  ActionIcon,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconExternalLink, IconAlertCircle } from '@tabler/icons-react';

interface Domain {
  domain_id: number;
  domain_name: string;
  cloudflare_zone_id: string;
  subdomains: Subdomain[];
}

interface Subdomain {
  subdomain_id: number;
  subdomain_name: string;
  full_domain: string;
  target_port: number;
  target_scheme: string;
  is_active: boolean;
  npm_ssl_enabled: boolean;
  description: string | null;
  created_at: string;
}

export default function HomePage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    subdomain_name: '',
    target_port: 3000,
    domain_id: '',
    target_scheme: 'http',
    enable_ssl: false,
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [domainsRes, subdomainsRes] = await Promise.all([
        fetch('/api/domains'),
        fetch('/api/subdomains'),
      ]);

      const domainsData = await domainsRes.json();
      const subdomainsData = await subdomainsRes.json();

      if (domainsData.success) {
        setDomains(domainsData.data);
      }

      if (subdomainsData.success) {
        setSubdomains(subdomainsData.data);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubdomain = async () => {
    try {
      setSubmitting(true);

      const response = await fetch('/api/subdomains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          domain_id: parseInt(formData.domain_id),
        }),
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: result.message,
          color: 'green',
        });

        setModalOpened(false);
        setFormData({
          subdomain_name: '',
          target_port: 3000,
          domain_id: '',
          target_scheme: 'http',
          enable_ssl: false,
          description: '',
        });

        loadData();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error,
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubdomain = async (subdomain_id: number, full_domain: string) => {
    if (!confirm(`Are you sure you want to delete ${full_domain}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/subdomains/${subdomain_id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: result.message,
          color: 'green',
        });

        loadData();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error,
          color: 'red',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={1}>DNS Manager</Title>
            <Text c="dimmed" size="sm">
              Manage subdomains for openplp.org
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpened(true)}
            disabled={domains.length === 0}
          >
            Add Subdomain
          </Button>
        </Group>

        {/* Setup Warning */}
        {domains.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} title="Setup Required" color="yellow">
            No domains configured. Please add your domain (openplp.org) first by accessing the
            database or using the API.
          </Alert>
        )}

        {/* Subdomains Table */}
        <Paper shadow="sm" p="md" withBorder>
          <Title order={3} mb="md">
            Active Subdomains ({subdomains.length})
          </Title>

          {subdomains.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No subdomains configured yet. Click "Add Subdomain" to get started.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Subdomain</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>SSL</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subdomains.map((subdomain) => (
                  <Table.Tr key={subdomain.subdomain_id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Text fw={500}>{subdomain.full_domain}</Text>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          component="a"
                          href={`http://${subdomain.full_domain}`}
                          target="_blank"
                        >
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {subdomain.target_scheme}://{subdomain.target_port}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={subdomain.npm_ssl_enabled ? 'green' : 'gray'} size="sm">
                        {subdomain.npm_ssl_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={subdomain.is_active ? 'green' : 'red'} size="sm">
                        {subdomain.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {subdomain.description || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() =>
                          handleDeleteSubdomain(subdomain.subdomain_id, subdomain.full_domain)
                        }
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Create Subdomain Modal */}
        <Modal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title="Add New Subdomain"
          size="lg"
        >
          <Stack gap="md">
            <Select
              label="Domain"
              placeholder="Select domain"
              required
              data={domains.map((d) => ({
                value: d.domain_id.toString(),
                label: d.domain_name,
              }))}
              value={formData.domain_id}
              onChange={(value) => setFormData({ ...formData, domain_id: value || '' })}
            />

            <TextInput
              label="Subdomain Name"
              placeholder="e.g., blog, api, admin"
              required
              description="Leave empty or use '@' for root domain"
              value={formData.subdomain_name}
              onChange={(e) => setFormData({ ...formData, subdomain_name: e.target.value })}
            />

            <NumberInput
              label="Target Port"
              placeholder="3000"
              required
              min={1}
              max={65535}
              value={formData.target_port}
              onChange={(value) => setFormData({ ...formData, target_port: value as number })}
            />

            <Select
              label="Protocol"
              required
              data={[
                { value: 'http', label: 'HTTP' },
                { value: 'https', label: 'HTTPS' },
              ]}
              value={formData.target_scheme}
              onChange={(value) =>
                setFormData({ ...formData, target_scheme: value || 'http' })
              }
            />

            <Switch
              label="Enable SSL Certificate (Let's Encrypt)"
              description="Automatically request and configure SSL certificate"
              checked={formData.enable_ssl}
              onChange={(e) => setFormData({ ...formData, enable_ssl: e.target.checked })}
            />

            <Textarea
              label="Description"
              placeholder="Optional description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setModalOpened(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSubdomain} loading={submitting}>
                Create Subdomain
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
