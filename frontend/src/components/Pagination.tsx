import React from 'react';
import { Flex, Text, IconButton } from '@radix-ui/themes';
import MyButton from './MyButton';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}) => {
  // Calculate the range of pages to show (5 pages total)
  const getVisiblePages = (): number[] => {
    const pages: number[] = [];

    if (totalPages <= 5) {
      // If total pages is 5 or less, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show 5 pages with current page in the middle when possible
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);

      // Adjust if we're near the end
      if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  const handlePageChange = (page: number) => {
    if (!disabled && page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handleFirst = () => handlePageChange(1);
  const handlePrevious = () => handlePageChange(currentPage - 1);
  const handleNext = () => handlePageChange(currentPage + 1);
  const handleLast = () => handlePageChange(totalPages);

  // Don't render pagination if there's only one page or no pages
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Flex align="center" gap="2" justify="center" py="4">
      {/* First Page Button */}
      <IconButton
        variant="soft"
        color="gray"
        disabled={disabled || isFirstPage}
        onClick={handleFirst}
        size="2"
        style={{ cursor: disabled || isFirstPage ? 'not-allowed' : 'pointer' }}
      >
        <DoubleArrowLeftIcon />
      </IconButton>

      {/* Previous Page Button */}
      <IconButton
        variant="soft"
        color="gray"
        disabled={disabled || isFirstPage}
        onClick={handlePrevious}
        size="2"
        style={{ cursor: disabled || isFirstPage ? 'not-allowed' : 'pointer' }}
      >
        <ChevronLeftIcon />
      </IconButton>

      {/* Page Number Buttons */}
      <Flex align="center" gap="1">
        {visiblePages.map(page => (
          <MyButton
            key={page}
            variant={page === currentPage ? 'solid' : 'soft'}
            color={page === currentPage ? 'blue' : 'gray'}
            disabled={disabled}
            onClick={() => handlePageChange(page)}
            size="2"
            style={{
              minWidth: '40px',
            }}
          >
            {page}
          </MyButton>
        ))}
      </Flex>

      {/* Next Page Button */}
      <IconButton
        variant="soft"
        color="gray"
        disabled={disabled || isLastPage}
        onClick={handleNext}
        size="2"
        style={{}}
      >
        <ChevronRightIcon />
      </IconButton>

      {/* Last Page Button */}
      <IconButton
        variant="soft"
        color="gray"
        disabled={disabled || isLastPage}
        onClick={handleLast}
        size="2"
        style={{}}
      >
        <DoubleArrowRightIcon />
      </IconButton>

      {/* Page Info */}
      <Text size="2" color="gray" ml="3">
        Page {currentPage} of {totalPages}
      </Text>
    </Flex>
  );
};

export default Pagination;
