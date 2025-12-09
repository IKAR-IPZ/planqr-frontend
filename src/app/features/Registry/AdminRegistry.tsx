import { useEffect, useState } from 'react';
import { Button, Card, Form, Header, Segment, Container, Icon, Confirm, Modal, Label, Grid, Message } from 'semantic-ui-react';

interface Device {
    id: number;
    deviceName: string | null;
    deviceClassroom: string | null;
    deviceURL: string | null;
    deviceId: string;
    status: 'PENDING' | 'ACTIVE';
}

const AdminRegistry = () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5000';
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State for Registration
    const [registerModalOpen, setRegisterModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [formClassroom, setFormClassroom] = useState('');

    // Delete Confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const fetchDevices = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${siteUrl}/api/devices`);
            if (response.ok) {
                const data = await response.json();
                setDevices(data);
            }
        } catch (error) {
            console.error('Error fetching devices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 5000); // Poll for updates
        return () => clearInterval(interval);
    }, []);

    const openRegisterModal = (device: Device) => {
        setSelectedDevice(device);
        setFormClassroom('');
        setRegisterModalOpen(true);
    }

    const handleRegister = async () => {
        if (!selectedDevice || !formClassroom) return;

        try {
            const response = await fetch(`${siteUrl}/api/devices/${selectedDevice.id}`, {
                method: 'PUT', // Activate
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedDevice.id,
                    deviceName: formClassroom, // Use Room as Name
                    deviceClassroom: formClassroom
                })
            });

            if (response.ok) {
                setRegisterModalOpen(false);
                fetchDevices();
            }
        } catch (error) {
            console.error("Error registering device", error);
        }
    }

    const handleDelete = async () => {
        if (deleteId === null) return;
        try {
            await fetch(`${siteUrl}/api/devices/${deleteId}`, { method: 'DELETE' });
            fetchDevices();
        } catch (error) {
            console.error('Error deleting device:', error);
        } finally {
            setConfirmOpen(false);
            setDeleteId(null);
        }
    };

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const activeDevices = devices.filter(d => d.status === 'ACTIVE');

    return (
        <Container style={{ padding: '2em', background: '#f8f9fa', minHeight: '100vh', maxWidth: '100%' }}>
            <Header as='h2' icon textAlign='center' style={{ marginBottom: '2em' }}>
                <Icon name='tablet alternate' color='blue' circular />
                <Header.Content>Device Control Center</Header.Content>
            </Header>

            <Grid stackable columns={pendingDevices.length > 0 ? 2 : 1}>
                {pendingDevices.length > 0 && (
                    <Grid.Column width={6}>
                        <Segment raised color='orange'>
                            <Header as='h3' color='orange'>
                                <Icon name='bell' />
                                Pending Requests
                                <Label color='orange' circular floating>{pendingDevices.length}</Label>
                            </Header>
                            <Card.Group itemsPerRow={1}>
                                {pendingDevices.map(device => (
                                    <Card key={device.id} fluid style={{ borderLeft: '4px solid #f2711c' }}>
                                        <Card.Content>
                                            <Card.Header style={{ fontSize: '1.5em', fontFamily: 'monospace' }}>
                                                {device.deviceId}
                                            </Card.Header>
                                            <Card.Meta>Waiting for assignment</Card.Meta>
                                        </Card.Content>
                                        <Card.Content extra>
                                            <div className='ui two buttons'>
                                                <Button basic color='green' onClick={() => openRegisterModal(device)}>
                                                    <Icon name='check' /> Assign Room
                                                </Button>
                                                <Button basic color='red' onClick={() => { setDeleteId(device.id); setConfirmOpen(true); }}>
                                                    <Icon name='trash' /> Reject
                                                </Button>
                                            </div>
                                        </Card.Content>
                                    </Card>
                                ))}
                            </Card.Group>
                        </Segment>
                    </Grid.Column>
                )}

                <Grid.Column width={pendingDevices.length > 0 ? 10 : 16}>
                    <Segment raised color='green'>
                        <Header as='h3' color='green'>
                            <Icon name='check circle' />
                            Active Terminals
                            <Label color='green' circular floating>{activeDevices.length}</Label>
                        </Header>

                        {activeDevices.length === 0 ? (
                            <Message info>
                                <Message.Header>No Active Devices</Message.Header>
                                <p>Waiting for devices to connect and register.</p>
                            </Message>
                        ) : (
                            <Card.Group itemsPerRow={4} stackable doubling>
                                {activeDevices.map(device => (
                                    <Card key={device.id} color='green'>
                                        <Card.Content>
                                            <Icon name='tv' size='large' style={{ float: 'right', color: '#21ba45' }} />
                                            <Card.Header>{device.deviceClassroom}</Card.Header>
                                            <Card.Meta>Code: {device.deviceId}</Card.Meta>
                                            <Card.Description>
                                                <strong>Status:</strong> <span style={{ color: 'green' }}>Online</span>
                                            </Card.Description>
                                        </Card.Content>
                                        <Card.Content extra>
                                            <Button.Group fluid size='small'>
                                                <Button icon='external' content='View' as='a' href={`/tablet/WI/${device.deviceClassroom}/${device.deviceURL}`} target="_blank" />
                                                <Button icon='trash' color='red' onClick={() => { setDeleteId(device.id); setConfirmOpen(true); }} />
                                            </Button.Group>
                                        </Card.Content>
                                    </Card>
                                ))}
                            </Card.Group>
                        )}
                    </Segment>
                </Grid.Column>
            </Grid>

            {/* CONFIRM DELETE */}
            <Confirm
                open={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                content='Are you sure you want to remove this device? It will need to re-pair.'
                confirmButton='Delete'
                cancelButton='Cancel'
            />

            {/* REGISTER MODAL */}
            <Modal
                open={registerModalOpen}
                onClose={() => setRegisterModalOpen(false)}
                size='mini'
            >
                <Header icon='map marker alternate' content='Assign Room' />
                <Modal.Content>
                    <Form>
                        <p>Pairing Device <strong>{selectedDevice?.deviceId}</strong></p>
                        <Form.Field>
                            <label>Room Identifier (e.g. WI WI1- 308)</label>
                            <input
                                placeholder='e.g. 101'
                                value={formClassroom}
                                onChange={e => setFormClassroom(e.target.value)}
                                autoFocus
                            />
                        </Form.Field>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button color='grey' onClick={() => setRegisterModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button color='green' onClick={handleRegister} disabled={!formClassroom}>
                        <Icon name='checkmark' /> Activate
                    </Button>
                </Modal.Actions>
            </Modal>

        </Container>
    );
};

export default AdminRegistry;
