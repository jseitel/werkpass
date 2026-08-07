import { prisma, type Customer } from "@lingl-docs/db";

export interface CreateCustomerInput {
  organizationId: string;
  name: string;
  customerNumber?: string;
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return prisma.customer.create({ data: input });
}

export function listCustomers(organizationId: string): Promise<Customer[]> {
  return prisma.customer.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
}

export function getCustomerById(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}
